# گزارش هکر قرمزتیم — Task ID: 60-hack (حملهٔ سخت‌گیرانه به فیکس‌های فاز ۲)

- **تاریخ:** 1405-07-04 · **کامیت هدف:** `e2791da` (fix(phase-2): BUG-01..05)
- **نقش:** هکر قرمزتیم — هدف: شکستن فیکس‌ها قبل از اینکه واقعاً بشکنند
- **محیط:** dev server روی :3000 (سلامت: `/api/health` = 200، db.connected) · PostgreSQL پرتابل 16.4 · دیتای تستی فقط با مارکرهای اختصاصی `H60A*` / تلفن‌های `0931..0939` / `0923*`
- **قوانین رعایت‌شده:** بدون ویرایش src/، بدون commit/push، بدون ری‌استارت سرور، بدون /admin/settings، بدون cred ادمین (برای همهٔ ۵ حمله)، فقط آسیب به دیتای خودم + cleanup کامل
- **شواهد خام:** `qa-reports/tmp-60/` (اسکریپت‌های حمله + JSON نتایج + خروجی flood)

---

## حملهٔ ۱ — رقابت کوپن perUser (سرویس‌لول، تراکنش موازی)

**روش:** اسکریپت bun با PrismaClient مستقیم روی `consumeCouponInTx` (همان دروازه‌ای که `placeOrder` صدا می‌زند) — دو دور کامل مستقل برای اطمینان از تکرارپذیری.

**بردار A — کوپن perUser=2 + ۲۰ سفارش مهمان + ۲۰ tx موازی:**
- نتیجه در **هر دو دور**: `ok=2` · `COUPON_INVALID=18` · Redemption گمنام = 2 · `usedCount=2`
- انتظار دقیقاً ۲ → **دقیقاً ۲** — قفل `SELECT…FOR UPDATE` هر ۲۰ تراکنش را سریال کرد و شمارش زیر قفل بی‌نقص بود.

**بردار B — حملهٔ ترکیبی: کوپن perUser=3 + ۱۰ کاربر لاگین (هرکدام ۱ سفارش) + ۱۰ مهمان، ۲۰ tx موازی همزمان:**
- نتیجه: `okUsers=10` (maxPerUser=1)، `okGuests=3` (سبد گمنام مشترک دقیقاً در ۳ قفل شد)، `total=13`
- انتظار ≤ 3+10=13 → **دقیقاً 13** — نه مهمان توانست از سبد گمنام عبور کند (ADR فیکس BUG-02 درست کار می‌کند)، نه کاربر از سقف خودش.

**بردار C — سقف سریالی per-user (همان کوپن B):** مصرف دوم و سوم کاربر `OK` · مصرف چهارم `COUPON_INVALID` · جمع کاربر = 3 · `usedCount == COUNT(Redemption)` ✓

| سنجه | انتظار | واقعی (دو دور) |
|---|---|---|
| A: موفق از ۲۰ مهمان | ۲ | **۲ / ۲** |
| B: مهمان از ۱۰ | ≤3 | **۳ / ۳** |
| B: کاربران | ۱۰ (هرکدام ≤۱) | **۱۰ / ۱۰** |
| B: جمع | ≤13 | **۱۳ / ۱۳** |
| C: مصرف چهارم کاربر | رد | **COUPON_INVALID ✓** |

**رأی: DEFENDED 🟢** — هیچ انحراف عددی در دو دور مشاهده نشد.

---

## حملهٔ ۲ — flood روی callback ناموفق + cancel همزمان (HTTP)

**روش:** فیکسچر سرویس‌لول (سفارش PENDING + رزرو ACTIVE qty=2 + پرداخت PENDING با authority اختصاصی)؛ سپس **۳۰ درخواست curl موازی** به `GET /checkout/callback?authority=…&status=NOK` همزمان با فراخوانی سرویس‌لول `cancelOrder(actor: customer)`. چون در اولین شلیک cancel برنده شد (سفارش CANCELLED و پرداخت هنوز PENDING ماند)، دومین شلیک flood دقیقاً سناریوی «callback بعد از لغو» را — همان مسیری که قبلاً P2025/rollback می‌ساخت — تست کرد.

**شواهد عددی:**
- **۳۰/۳۰ پاسخ = `307` → `/checkout/failed`** · **صفر 500** · صفر کرش در `dev.log` (هر ۳۰ لاگ `307` تمیز)
- بعد از flood: `Payment.status=FAILED` با `failReason="پرداخت توسط کاربر لغو شد."` · رخداد `PaymentFailed` **دقیقاً ۱** در Outbox · رزرو `RELEASED` · `reserved=0` · سفارش `CANCELLED`
- cancel همزمان دوم روی سفارشِ لغوشده: `INVALID_TRANSITION` تمیز (۴۰۹) — بدون هیچ جهش
- اثبات جانبی: پیامک `order-cancelled` رخدادِ `OrderCancelled` فیکسچر را در 12:46:06 dispatch کرد (خود ردیف Outbox بعدها در پنجرهٔ پاکسازی مشترکِ تست‌های موازی حذف شد — آرتیفکت محیط، نه فیکس)

**پروب‌های تکمیلی:**
| پروب | پاسخ | تحلیل |
|---|---|---|
| callback تکراری پس از FAILED | `307 → /checkout/failed` | idempotent — بدون خطا، بدون رخداد تکراری |
| برانگیختگی: `status=OK` روی FAILED | `307 → /checkout/failed` · Payment می‌ماند FAILED · PaymentSucceeded=0 | resurrection ناممکن ✓ |
| بدون authority | `307 → /checkout?error=payment` | رد تمیز |
| POST روی callback | **405** | متد بسته |
| authority خیالی | `307 → /checkout/failed` (عین پاسخ تکراریِ واقعی) | اوراکل شمارش/نشت نیست |
| درگاه mock با authority بدون کوکی اثبات | 200 ولی بدون مبلغ/کد سفارش | SEC-07 سر جایش ✓ |

**رأی: DEFENDED 🟢** — یک Payment واحد FAILED، یک رخداد واحد، صفر 500، پاسخ تکراری 307 بدون نشت اطلاعات.
**نکتهٔ رصدی (غیربلوکه):** مسیر callback هیچ rate-limit اختصاصی ندارد (۳۰ موازی بدون 429 عبور کردند) — idempotency پوشش می‌دهد ولی یک قانون سبک برای callback/webhook در فاز ۳ سودمند است.

---

## حملهٔ ۳ — دستکاری گذار وضعیت از بیرون (بدون cred ادمین)

**روش:** بدترین حالت را شبیه‌سازی کردم: **Server Action ID ادمین را از chunkهای کامپایل‌شدهٔ dev استخراج کردم** (`transitionOrderAction` / `shipOrderAction` / `refundOrderAction` — attacker واقعی هم IDها را از باندل کلاینت بیرون می‌کشد) و مستقیم با هدر `Next-Action` و encoding صحیح (کشف‌شده تجربی: body = آرایهٔ JSON `[args]` + `Content-Type: text/plain`) به صفحات POST کردم — بدون هیچ کوکی نشست.

**شواهد:**
| بردار | پاسخ | جهش؟ |
|---|---|---|
| transitionOrderAction→CANCELLED/DELIVERED روی `/admin/orders` بدون نشست | **307 → /admin/login** | صفر |
| shipOrderAction / refundOrderAction بدون نشست | **307 → /admin/login** | صفر |
| همان‌ها با **کوکی جلسهٔ جعلی** | **307 → /admin/login** | صفر |
| مسیرهای پوششی: `/admin/orders/` · `//admin/orders` · `/admin%2Forders` | 308 نرمال‌سازی / 307 login | صفر |
| id اکشن ادمین از صفحهٔ غیرادمین (`/checkout`) | **200 `{}`** — اکشن اجرا نشد (bind به worker صفحه) | صفر |
| id جعلی روی `/checkout` | **404 "Server action not found."** | صفر |
| `GET /api/admin/notifications` بدون نشست | **401 `UNAUTHENTICATED`** JSON تمیز | صفر |

- راستی‌آزمایی DB روی سفارش PENDING هدف (مال خودم): پس از ۱۳ پروب → `status=PENDING` · audit=0 · shipment=0 · Outbox=0 — **صفر جهش**
- پوشش رفتاری BUG-04 از حملهٔ ۲ هم تأیید شد: `cancelOrder(customer)` روی PENDING مجاز، روی CANCELLED → INVALID_TRANSITION تمیز؛ هیچ مسیر عمومیِ تغییر وضعیت سفارش وجود ندارد.

**رأی: DEFENDED 🟢** — گارد دو لایه (پروکسی `/admin/*` قبل از اکشن + `withAdminAction→requirePermission`) حتی در سناریوی نشتِ Action ID نفوذناپذیر ماند؛ پاسخ‌ها همیشه تمیز (307/401/404)، بدون اطلاعات دامنه.

---

## حملهٔ ۴ — محصولِ همه-واریانت-غیرفعال (BUG-05 / mapper)

**هدف:** فیکسچر موجود `test-inactive-all-variants` (`cmuidi04g0001nddxi8k62fqf` — دو واریانت `isActive=false` با stock ۵ و ۳) — فقط خوانده شد، مالِ من نیست.

**بردارها و شواهد:**
1. **سرویس‌لول (سقفِ قدرتِ هر دستکاری کلاینت):** `placeOrder` با سه‌تاییِ واریانت غیرفعال، دو بار (qty=1 و qty=2) → هر دو `DomainError OUT_OF_STOCK — «یکی از کالاهای سبد دیگر قابل خرید نیست.»` — هیچ رزروی ساخته نشد.
2. **HTTP واقعی:** فراخوانی مستقیم Server Action عمومی `placeOrderAction` با encoding کشف‌شده در حملهٔ ۳ و `lineId` دستکاری‌شدهٔ سبد (`<productId>__-__-` — دقیقاً همان چیزی که localStorage جعلی می‌فرستد) → `{"ok":false,"message":"یکی از کالاهای سبد دیگر قابل خرید نیست."}`
3. **DB بعد از هر دو بردار:** reservations=0 · orders=0 · `reserved` هر دو واریانت = 0 — **صفر جهش**
4. **نمایش صادقانه:** صفحهٔ `/product/test-inactive-all-variants` شامل «ناموجود» است (mapper فیکس‌شده stock=0 — دیگر fallback فریبندهٔ ۸ وجود ندارد).

**رأی: DEFENDED 🟢** — resolve سه‌تایی سمت سرور (فیلتر `isActive:true` + `status:ACTIVE`) واریانت غیرفعال را در هر دو لایه (سرویس/Server Action) با خطای دامنه تمیز رد می‌کند؛ کلاینت هر چه دستکاری کند قابل خرید نیست.

---

## حملهٔ ۵ — نشت راز در دیف `e2791da`

**روش:** کل دیف (۹۶۹ خط) با الگوهای گسترده اسکن شد: `password|passwd|secret|token|api_key|access_key|private_key|bearer|AKIA…|BEGIN … KEY|://user:pass@|admin@…`

**یافته‌ها (۳ match):**
| # | خط دیف | محتوا | شدت |
|---|---|---|---|
| 1 | **949 (worklog.md)** | 🔴 **رمز پنل ادمین به‌صورت plaintext** در مدخل Task-59: «رمز جدید ادمین: admin@prima-store.ir / `tgC…Z`» | **HIGH** |
| 2 | 383 (تست concurrency کوپن) | 🟡 URL دیتابیس dev با پسورد به‌عنوان fallback (`prima:prima_dev_only@127.0.0.1`) | INFO |
| 3 | 613 (تست race پرداخت) | 🟡 همان fallback | INFO |

- ریپو روی گیت‌هاب **عمومی است** (`github.com/pooboy400/towel-parima` → HTTP 200) و شاخهٔ محلی **ahead-1** است یعنی این دیف هنوز push نشده — با اولین push، رمز ادمین عمومی می‌شود.
- نکتهٔ مهم برای جستجوی پیش‌فرضِ مأموریت: الگوی `password|secret|token|key` به‌تنهایی این نشت را **نمی‌گیرد** (کلمهٔ کلیدی فارسی «رمز» + مقدار خام است) — الگوی من `://user:pass@` و دنبال‌کردن `admin@` آن را شکار کرد.

**رأی: BREACHED 🔴 (بهداشت راز — نه باگ فیکس‌های پول)** — با فیکس‌های BUG-01..05 بی‌ربط است، ولی یک نشت واقعی و فوری است.

---

## Cleanup (الزام مأموریت)

`qa-reports/tmp-60/cleanup.ts` — حذف به ترتیب FK و فقط با مارکرهای خودم؛ نتیجهٔ نهایی:
- سفارش‌های من (۴۸ ردیف با تلفن‌های `0931..0939` + دو id مستقیم): **0 باقی‌مانده** · پرداخت/رزرو/رفاند/Outbox/SMS من: **0** · کوپن‌های `H60A*` و همهٔ Redemptionهایشان: **0** · کاربران `0923*`: **0** · محصول تستی خودم (`h60p*-prod`): **0**
- دست‌نخورده: سید (۱۲ محصول)، فیکسچر QA قبلی `test-inactive-all-variants`، و **۲ سفارش در جریانِ ایجنت‌های موازی** (مال من نبود — لمس نشد)
- سلامت سرور بعد از حمله: `/api/health` = 200 · بدون OOM/کرش

## جمع‌بندی فرمانده

- فیکس‌های پول فاز ۲ (کوپن perUser+قفل، سبد گمنام مهمان، failPayment اتمیک/idempotent، ماشین وضعیت بازیگر-محور، mapper صادق) در برابر **۴ حملهٔ فعال + ۲۵+ پروب** حتی یک نفوذ نداشتند — اعداد دقیقاً روی مرز انتظار قفل شدند.
- تنها یافتهٔ قرمز خارج از محدودهٔ فیکس است: **رمز plaintext ادمین داخل worklog.md در کامیت `e2791da`** — پیشنهاد فوری: (۱) چرخش رمز ادمین (۲) حذف/ویرایش آن خط از worklog قبل از هر push (۳) برای آینده: رمزها هرگز در worklog/گزارش‌ها.
- اقلام رصدی فاز ۳: rate-limit اختصاصی برای `/checkout/callback`؛ حذف fallback URL دیتابیس از دو فایل تست.
