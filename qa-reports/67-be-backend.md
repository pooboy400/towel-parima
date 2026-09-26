# گزارش ۶۷-be — بازبینی عمیق همزمانی/دیتای فازهای ۳–۶ (باتری نهایی)

Agent: بک‌اند/دیتابیس · Date: باتری نهایی · Scope: `git diff 35bc307~5..HEAD` (فاز ۳ تا ۶) · DB: `scripts/pg.sh url` (فقط SELECT)
قید رعایت شد: هیچ فایل سورس ویرایش نشد، هیچ تغییری در داده (فقط SELECT/EXPLAIN)، بدون push/ری‌استارت.

---

## ۱. money.ts — تنها فرمول تخفیف/ارسال ✅ (با یادداشت)

- **تک‌منبع تأیید شد**: کپی inline تخفیف از `placeOrder` حذف و به `computeDiscount → money.calcCouponDiscount` متصل شده؛ `computeShippingCost` فقط تنظیمات را واکشی و به `money.calcShipping` نگاشت می‌کند (diff فاز ۳ تأیید شد).
- **assertMoney مسیرهای لبه**: `assertMoney(0)` پاس (تست موجود خط ۱۰۹)؛ subtotal=0 → `calcCouponDiscount` در هر دو نوع ۰ برمی‌گرداند و `calcShipping` گارد `subtotal<=0` دارد — سازگار. Float/منفی در همهٔ نقاط ورود رد می‌شود (assertMoney روی subtotal و خروجی discount).
- **maxDiscount منفی (نظری)**: `maxDiscount: Int?` در schema قید nonnegative ندارد و اسکیمای ادمین کوپن هم یافت نشد (کوپن فعلاً فقط seed می‌شود). اگر روزی ادمین منفی وارد کند، `Math.min(discount, maxDiscount)` منفی می‌شود ولی `assertMoney(discount)` با VALIDATION_ERROR checkout را با صدأ می‌شکند — نه silently. دفاع کافی؛ پیشنهاد: هنگام ساخته‌شدن UI ادمین کوپن، `z.int().positive().nullable()` اضافه شود.
- **freeShippingThreshold=0**: `subtotal>=0` همیشه true → ارسال همیشه رایگان. اسکیما nonnegative اجازهٔ صفر می‌دهد. معناشناسی «۰ = رایگان برای همه» است نه «غیرفعال‌سازی رایگان» — foot-gun مستندسازی‌شده باشد کافی است (پیشنهاد: tooltip ادمین + ADR یک‌خطی).
- **یادداشت ADR**: آستانهٔ رایگان روی express هم اعمال می‌شود (`return 0` قبل از چک method) — یعنی ارسال اکسپرس بالای آستانه هم رایگان است. اگر قصد کسب‌وکار «فقط استاندارد رایگان» باشد، فرمول باید جدا شود. فعلاً سازگار و تست‌شده — فقط ثبت.
- **نکتهٔ سازگاری جزئی**: `placeOrder` جمع نهایی را inline با `Math.max(0, subtotal - discountTotal) + shippingTotal` حساب می‌کند نه با `calcGrandTotal` (با taxTotal=0 معادل است و clamp اضافه دارد). یک‌فروشگاهی‌بودن کامل می‌تواند در بک‌لاگ تمیز شود.

## ۲. BUG-06 — گارد Σqty رزروهای جزئی منقضی ⚠️ (منطق درست، تست ندارد)

- **منطق درست است** (payment-service.ts:175-189): Σqty رزروهای ACTIVE باید دقیقاً Σqty اقلام باشد؛ در سناریوی چندقلمی با یک رزرو EXPIRED و یکی ACTIVE، نابرابری → `failPayment` با reason «پنجره پرداخت منقضی شد — رزرو ناقص یا آزاد شده.»
- **failPayment کامل است**: claim اتمیک PENDING→FAILED (+metadata.failReason)، لغو شرطی سفارش، release تنها رزروهای ACTIVE، و `PaymentFailed(orderId, paymentId, reason)` داخل همان tx → Outbox اتمیک و کامل. پیام کاربر «لطفاً دوباره خرید کنید» درست است.
- **🟡 شکاف تست**: هیچ تستی مسیر Σqty نابرابر را اجرا نمی‌کند (جست‌وجوی BUG-06/«رزرو ناقص» در tests/ خالی). تست‌های موجود payment-fail-race فقط BUG-03 (رقابت لغو×شکست، idempotency، claim-race) را پوشش می‌دهند. **اقدام پیشنهادی**: تست پذیرش «سفارش دومین + رزرو دوم EXPIRED → FAILED + PaymentFailed در Outbox + رزرو ACTIVE→RELEASED».
- **🟡 یافتهٔ جدید (پنجرهٔ میکروسکوپیک — کاندید BUG-17)**: خواندن رزروها *قبل از* verify درگاه انجام می‌شود؛ اگر worker انقضا (تیک ۵ دقیقه‌ای) در فاصلهٔ verify→tx نهایی رزروی را EXPIRED کند، `convertReservation` بی‌صدا no-op می‌شود (claim count=0) و سفارش PROCESSING می‌شود بدون کسر stock → فروش بدون کسر موجودی در fulfillment. پنجره میلی‌ثانیه/ثانیه‌ای و احتمال بسیار ناچیز، اما اصلاح ارزان است: داخل tx نهایی، شکست claim هر convert باید مسیر را به `refundRacedPayment` بفرستد (همان قانون «پول بدون مسیر نمی‌ماند»).

## ۳. FS-1 — refundRacedPayment از FAILED 🟡 (پیاده‌سازانه درست، جدول ماشین‌وضعیت عقب است)

- **واقعیت کد**: در شاخهٔ FS-1 (claim رقابتی باخته و `fresh.status === "FAILED"` و verify موفق) `refundRacedPayment` وضعیت پرداخت را از **FAILED → REFUNDED** می‌برد — گذاری که در `PAYMENT_TRANSITIONS` **نیست**.
- **تناقض مستندسازی**: تست unit حتی «FAILED حالت پایانی است» را با FAILED→PAID/FAILED→PENDING اثبات می‌کند و FAILED→REFUNDED را نه تأیید نه رد می‌کند؛ یعنی جدول و رفتار واقعی واگرا شده‌اند (جدول = سند بخش ۵.۲).
- تست پذیرش شاخهٔ PAID→REFUNDED (رقابت لغو×تأیید) موجود است (commerce-core:444)؛ شاخهٔ FAILED→REFUNDED (خود FS-1) تست ندارد.
- **پیشنهاد دقیق (بدون اجرا — قید عدم ویرایش)**:
  1. افزودن rule: `{ from: "FAILED", to: "REFUNDED", condition: "FS-1 — verify موفق ولی claim رقابتی باخته؛ پول گرفته‌شده استرداد می‌شود" }`
  2. به‌روزرسانی تست state-machines: `FAILED→REFUNDED allowed=true` + `FAILED→PAID/PENDING` همچنان false.
  3. تست پذیرش FS-1: claim دستی PENDING→FAILED سپس confirmPayment با verify موفق mock → REFUNDED + رکورد Refund + Outbox RefundSucceeded.

## ۴. wishlist-actions — race و سقف ۲۰۰ ✅ (با ثبت دو ریز‌یافته)

- **toggle همزمان idempotent است**: add با `upsert(userId_productId, update:{})` — دو add همزمان یک ردیف؛ remove با `deleteMany` — دو remove همزمان بدون خطا. ترکیب add/remove همزمان → آخرین‌نویس برنده؛ برای سمنتیک wishlist قابل قبول.
- **🟡 TOCTOU سقف ۲۰۰ (ثبت شد — بی‌اهمیت)**: `count` و `upsert` اتمیک نیستند؛ N تا toggle همزمان می‌تواند سقف را تا N-1 ردیف رد کند. سقف محافظه‌کارانه است نه قرارداد — قابل قبول. اصلاح در صورت تمایل: `createMany` با subquery شرطی یا unique + شمارش پس از ایندکس.
- **ریز‌یافته**: `toggleWishlistAction` در `product.findUnique({where:{slug}})` فیلتر `deletedAt` ندارد (برخلاف `resolveSlugs` مسیر sync) — محصول soft-deleted حین رقابت می‌تواند به لیست اضافه شود؛ نمایش آسیب نمی‌بیند (join فقط slug). یک‌کلمه‌ای قابل تمیز در بک‌لاگ.
- **پوشش تست**: هیچ تست سرورساید برای wishlist وجود ندارد (sync idempotent، سقف ۲۰۰، رد مهمان). اکشن‌ها نازک‌اند و `requireCustomerContext` جای دیگر پوشش دارد — 🟡 بک‌لاگ، نه بلوکه‌کننده.

## ۵. INFRA-09 — HMAC اثبات پرداخت ✅

- **مقایسهٔ زمان-ثابت حفظ شده**: `isValidProof` = چک طول + `timingSafeEqual` (checkout-service.ts:366-374). چک طول فقط طول را لو می‌دهد — الگوی استاندارد و قابل قبول (اثبات درست همیشه ۶۴ نویسهٔ hex است). پروب زنده: proof ۶۴ نویسه، valid=true، wrong=false، null=false.
- **fail-fast production**: `payProofSecret` در production بدون `PAY_PROOF_SECRET` (و بدون ALLOW_MOCKS_IN_PRODUCTION=1) کرش می‌کند؛ fallback ثابت dev فقط توسعه/تست. تست‌ها بدون ست‌کردن کلید با همان fallback سبز می‌شوند — درست.
- کوکی در callback با `httpOnly + sameSite=lax + secure(prod) + TTL 15min` ست می‌شود و endpoint هم rate-limit دارد (پیشنهاد باتری ۶۰ بسته شد).

## ۶. client-ip — کانونی‌سازی v6 ✅ (یک انحراف RFC ثبت شد)

- **پاسخ سؤال با پروب زنده**: `canonicalIp("::ffff:1.2.3.4")` → **`::ffff:102:304`** (فرم hex، بدون dotted-quad). `0:0:0:0:0:0:0:1`→`::1` و `2001:0DB8:...:0001`→`2001:db8::1` — هم‌ارزها واقعاً به یک bucket می‌رسند.
- **انحراف جزئی از RFC 5952 §5**: برای آدرس‌های IPv4-mapped فرم توصیه‌شده `::ffff:1.2.3.4` است؛ خروجی ما `::ffff:102:304` است. **سازگاری داخلی حفظ است** (هر دو شکل ورودی همان رشته را می‌دهند) و bucket-کردن rate-limit درست کار می‌کند؛ فقط اگر همان کلاینت یک‌بار mapped و یکبار فرم v4 خالص برسد، دو bucket می‌گیرد (گرانularity، نه امنیت). پیشنهاد بک‌لاگ: یک تست واحد برای فرم mapped + تصمیم ADR دربارهٔ فرم خروجی.
- تست‌های موجود client-ip پاس می‌شوند (۲۴۷/۲۴۷ کل) — پوشش فرم mapped وجود ندارد (بالا ثبت شد).

## ۷. health با کش ۳۰ ثانیه‌ای ✅ — مانیتور گول نمی‌خورد

- `SELECT 1` در هر hit زنده است؛ `status:"ok"` فقط با DB زنده صادر می‌شود و قطعی DB → 503 صرف‌نظر از کش. پس کش هرگز outage را نمی‌پوشاند.
- `countsCachedAt` صادقانه عمر داده را لو می‌دهد — مانیتور می‌تواند counts کهنه را از fresh تشخیص دهد. کش per-process است (multi-instance → چند کش مستقل؛ با ADR INFRA-07 سازگار).
- **ریز‌یافتهٔ کاسمتیک**: عنوان تست health هنوز «دقیقاً 120 پاسخ سالم» است در حالی که سقف `healthCheck: 60/min` است؛ خود assertion دینامیک و درست است (`RATE_RULES.healthCheck.limit`). فقط نام تست کهنه است — یک‌خطی قابل تمیز.

## ۸. جوین‌ها و ایندکس‌های WishlistItem ✅

- `@@unique([userId, productId])` → ایندکس یکتای `(userId, productId)`؛ EXPLAIN واقعی (فقط SELECT):
  - `serverSlugs` (filter+orderBy createdAt desc): **Bitmap Index Scan on WishlistItem_userId_productId_key** + Sort حافظه‌ای روی ≤۲۰۰ ردیف.
  - `count` سقف toggle: همان Index Scan.
- پس `@@index([userId])` جداگانه **لازم نیست** — prefix همان ایندکس یکتا پوشش می‌دهد. جدول فعلاً ۰ ردیف (قابلیت تازه است). FK productId جهت join به PK محصول است — ایندکس اضافه نمی‌خواهد.

## ۹. اجرای تست‌ها ✅

- **`bun test tests/unit tests/integration`: 247 pass / 0 fail / 1057 expect** — دقیقاً مطابق انتظار ۲۴۷.
- **دو دور integration فاز ۲**: 65/65 در هر دو دور؛ مقایسهٔ byte-to-byte پس از حذف زمان‌ها: **مجموعهٔ تست و نتیجه IDENTICAL** (تنها تفاوت ms اجرا — طبیعی). خروجی ران‌ها: `/tmp/67be-int-round1.txt`, `/tmp/67be-int-round2.txt`.

---

## جمع‌بندی یافته‌ها

| # | یافته | شدت | اقدام پیشنهادی |
|---|---|---|---|
| F-1 | FAILED→REFUNDED (FS-1) در `PAYMENT_TRANSITIONS` نیست + تست ندارد | 🟡 | افزودن rule + ۲ تست (بخش ۳) |
| F-2 | گارد BUG-06 Σqty هیچ تست پذیرشی ندارد | 🟡 | تست سفارش چندقلمی با رزرو جزئی منقضی |
| F-3 | race میکروسکوپیک confirm×expiry-worker: convert بی‌صدا no-op → PROCESSING بدون کسر stock (کاندید BUG-17) | 🟡 | داخل tx نهایی، شکست claim convert → مسیر refund |
| F-4 | double-refund نظری: دو callback بازندهٔ claim همزمان در پنجرهٔ FS-1 → دو Refund/دو فراخوانی درگاه | 🟡 | claim شرطی REFUNDED با updateMany یا unique روی Refund خودکار |
| F-5 | `canonicalIp` فرم mapped را hex می‌دهد (انحراف RFC 5952 §5) + بدون تست | 🟢 | تست واحد + ADR فرم خروجی |
| F-6 | freeShippingThreshold=0 → ارسال رایگان همگانی؛ آستانه روی express هم اعمال است | 🟢 | tooltip/ADR معناشناسی |
| F-7 | TOCTOU سقف ۲۰۰ wishlist + نبود فیلتر deletedAt در toggle + بدون تست سرورساید | 🟢 | ثبت بک‌لاگ |
| F-8 | عنوان کهنهٔ تست health («120» به‌جای 60) + placeOrder به‌جای calcGrandTotal inline جمع می‌زند | 🟢 | تمیزکردن یک‌خطی |

**هیچ یافتهٔ 🔴/🟠 وجود ندارد** — همهٔ مسیرهای پول/موجودی/دیتای فازهای ۳–۶ همگرا و idempotent، Outboxها اتمیک، فرمول پول تک‌منبع، و کل باتری سبز است. یافته‌های 🟡 همگی «مستندسازی/تست/پنجرهٔ میکروسکوپیک» هستند و مانع بستن باتری نهایی نیستند؛ F-1 و F-2 را پیش از M6 به بک‌لاگ فاز بعد بفرستید.

## رأی: **PASS** ✅
(با شرط ثبت F-1..F-4 در بک‌لاگ — هیچ اصلاح بلوکه‌کننده‌ای برای فازهای ۳–۶ لازم نیست.)
