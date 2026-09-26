# بازبین فول‌استک نهایی — Task 67-fs (باتری نهایی فازهای ۳-۶)

**دامنه:** `6f760ba..35bc307` (فاز ۳ تا ۶ — ۵ کامیت) · **روش:** اجرای مستقل تست‌ها + بازخوانی خط‌به‌خط دیف‌ها + تحلیل رقابت/گذارها
**محیط اجرا:** `DATABASE_URL` از `scripts/pg.sh` — بدون هیچ ویرایش کد، بدون commit/push

---

## ۱) اجرای مستقل و سلامت پایپ‌لاین

| چک | نتیجه |
|---|---|
| `bun test tests/unit tests/integration` | ✅ **۲۴۷/۲۴۷** (۱۰۵۶ expect · 1.85s · ۲۵ فایل) |
| `bunx tsc --noEmit` | ✅ صفر خطا (exit 0) |
| `bun run lint` (eslint .) | ✅ صفر خطا |
| وضعیت working tree | تمیز — فقط `qa-reports/tmp-67/` untracked |

---

## ۲) پاسخ به چک‌لیست

### چک ۲ — ترتیب لایه‌ها و CSP → FIXED-CONFIRMED
- CSP فقط از `src/proxy.ts` صادر می‌شود؛ grep کل `src` + `next.config.ts` هیچ منبع دوم ندارد. `next.config.ts:68-69` کامنت صریح حذف هدر تکراری دارد — **هیچ هدر CSP دوبل نمی‌آید** (دو CSP = سخت‌گیرترین تفسیر، ریسک قبلاً بسته).
- `middleware.ts` وجود ندارد (درس Next 16 رعایت شده — دو فایل = 404 سراسری).
- matcher `/((?!_next/static|_next/image|favicon.ico).*)` روی route handlers هم می‌چرخد ولی proxy فقط هدر اضافه می‌کند و body را لمس نمی‌کند — **تداخل کارکردی با rate-limitهای داخل handler (health/csp-report/search) وجود ندارد**؛ گارد URL/Origin در proxy مکمل handlerهاست نه جایگزین.
- الگوی `withCsp` (proxy.ts:75-82) همهٔ مسیرهای خروج از جمله ریدایرکت 307 ادمین را می‌پوشاند — یافتهٔ میانی خود فاز ۶ بسته است. هدر `Content-Security-Policy` روی request (nonce-propagation رسمی Next) + `Reporting-Endpoints` درست.
- نکتهٔ جزئی: `x-nonce` روی request هدر ست می‌شود (proxy.ts:70) ولی هیچ مصرف‌کننده‌ای در src ندارد — مکانیزم واقعی nonce، هدر CSP روی request است؛ بی‌ضرر ولی redundant.

### چک ۳ — BUG-08 فرمول واحد پول → FIXED-CONFIRMED
- `grep "Math.floor("` در کل src: تنها فرمول مالی `src/domain/policies/money.ts:55` است (بقیه: qty/format/time — غیرمالی).
- `checkout-service.ts:245` از `computeDiscount` استفاده می‌کند (کپی inline حذف شده — کامنت BUG-08) و `checkout-service.ts:82` از `money.calcShipping` با گارد `subtotal<=0` (money.ts:106). `coupon-service.computeDiscount` (خط 46-48) صرفاً delegate است — سه کپی موازی به یک منبع رسیده‌اند.

### چک ۴ — BUG-06 همگرایی confirm/fail/cancel → FIXED-CONFIRMED (با یک حاشیه 🟡 → یافته F-3)
- confirm: گارد Σqty رزروهای ACTIVE == Σqty اقلام (payment-service.ts:178-189) قبل از claim اتمیک PENDING→PAID (192-195)؛ رقابت لغو×تأیید با `updateMany` شرطی روی Order (224-228) → مسیر `refundRacedPayment` (FS-1) به‌جای کرش P2025.
- fail: claim اتمیک FAILED (356-362) + لغو شرطی سفارش (366-369) + release رزروهای ACTIVE + Outbox مستقل — idempotent و بدون حالت قفل‌شدهٔ جدید (Payment: PENDING→PAID/FAILED/REFUNDED؛ هیچ گذار خروجی از FAILED در ماشین‌ها — state-machines.test.ts:118 تأیید).
- cancel: claim با `updateMany where status` (order-service.ts:64-70) — CONFLICT به‌جای double-cancel.
- تست‌های `payment-fail-race.test.ts` (۳ سناریو: fail×cancel، callback دوم، confirm×fail) همگی سبز و ادعای همگرایی را اثبات می‌کنند.

### چک ۵ — UX-03 علاقه‌مندی → PARTIAL (عملیاتی درست، دو شکاف کوچک → F-5/F-6)
- درست: server actions با `requireCustomerContext` + سقف ۲۰۰ در toggle (wishlist-actions.ts:77-79)؛ مهمان روی localStorage با بنر شفاف (wishlist-view.tsx:38-46)؛ مهاجرت بعد از ورود از `syncAfterLogin` (cart-store.ts:181-184) و `CartSync` برای دستگاه دوم (cart-sync.tsx:33-36) — هر دو مسیر پوشش داده شده؛ `skipDuplicates` + بازگشت حقیقت سرور = idempotent.

### چک ۶ — INFRA-09 HMAC → FIXED-CONFIRMED
- `paidProofValue` = HMAC-SHA256 با `PAY_PROOF_SECRET` (checkout-service.ts:361-363)؛ مقایسهٔ زمان-ثابت با گارد طول (366-374). مصرف در هر دو گیت: mock-gateway (route.ts:55) و success (getOrderByCodeForSuccess:420).
- fail-fast: production بدون کلید و بدون `ALLOW_MOCKS_IN_PRODUCTION` → throw (350-358) — با فلسفهٔ گاردهای mock هم‌راستاست.
- سازگاری کوکی‌های قدیمی sha256: بی‌اعتبار می‌شوند ولی TTL فقط ۱۵ دقیقه داشتند و مسیر جایگزین (مالکیت نشست) در همان تابع فعال است — **قابل قبول، ریسک گذار صفر**.
- نکتهٔ تستی: تست SEC-07 عنوان کهنهٔ «sha256 authority» دارد ولی خودش از `paidProofValue` (HMAC) استفاده می‌کند → تست معتبر، عنوان گمراه‌کننده (F-8).

### چک ۷ — INFRA-04 گارد refund در دمو → FIXED-CONFIRMED
- زنجیرهٔ ۴ call-site به‌روز: refund-service.ts:126-130، order-service.ts:91-95، refundRacedPayment:287-291 — همه authority می‌فرستند.
- دموی production با `ALLOW_MOCKS_IN_PRODUCTION=1`: provider = mock → گارد mock (mock-payment.ts:61-63) پاس می‌شود → مسیر refund ادمین/خودکار کار می‌کند ✅. گارد زرین‌پال (zarinpal.ts:194-203) هم در همان محیط دمو باز می‌شود — با نیت «دمو» سازگار است (F-7: coupling معنایی را ثبت کنید).
- production واقعی (بدون فلگ‌ها): refund زرین‌پال → پیام «پیگیری دستی» + رکورد Refund FAILED — صادقانه و بدون پرداختِ مسیرِ کاذب.

### چک ۸ — رگرسیون فاز ۱ → هیچ رگرسیونی
- `client-ip.ts`: CR-2 (isIP)، CR-3 (BigInt CIDR)، CR-4 (رد /0 و اسلش + هشدار بلند)، CLIENT-IP-T1 (کانونی v6) — همگی دست‌نخورده؛ تغییر فاز ۳ صرفاً افزودنی (trim x-real-ip).
- SEC-04 (فاکتور دوم + normalizePhone در tracking)، SEC-05/CR-5 (خواندن bounded stream در csp-report)، SEC-06 (health بدون جزئیات خطا + سقف مستقل HEALTH-MON-01)، SEC-07 (اثبات درگاه) — همه سر جایشان با تست سبز.
- BUG-10 (اتمیک شدن تلاش OTP با `updateMany lt:5` — otp-auth-service.ts:183-185) و SEC-11 (devCode با شرط ثابت NODE_ENV — قابل dead-code-eliminate در بیلد) تأیید شد.

### چک ۹ — تست‌های جدید → کافی و معنادار
- رقابت واقعی DB (۱۰× موازی برای BUG-01/BUG-02)، اثبات HMAC با کوکی جعلی، سقف دقیق 120/30 با Retry-After، bounded chunked — همه assertionهای رفتاری، نه شمارش خطوط. ۲ تست CSP خالص + بازطراحی rbac (۲۹ مجوز، یکتایی) — +۲ تست نسبت به ۲۴۵، نسبت به حجم تغییر فاز ۳-۶ حداقلی ولی هدفمند؛ شکاف پوشش: proxy.ts (هدر CSP زنده و گارد Origin) فقط unit-builder دارد و تست integration ندارد (اثباتش دستی بود) — به‌عنوان توصیه، نه نقص بلوکه‌کننده.

---

## ۳) یافته‌ها

| # | شدت | فایل:خط | یافته | رأی |
|---|---|---|---|---|
| F-1 | 🟡 متوسط (زمان دیپلوی) | `src/lib/allowed-origins.ts:24-38` | **`isAllowedOrigin` ورودی‌های exact/scheme‌دار env را نادیده می‌گیرد.** تابع فقط «تساوی origin==host» یا «wildcard دومن‌طرفه» را قبول می‌کند؛ الگوی exact (مثل `prima-store.ir` یا `https://www.prima-store.ir` طبق مثال کامنت همین فایل) هرگز با originHost مقایسه نمی‌شود. در دیپلویی که پروکسی `x-forwarded-host` را بازنویسی کند (سناریوی مستند در next.config.ts:25-28)، Server Actionها با env تنظیم‌شده هم 403 می‌شوند — یعنی «منبع یگانه» INFRA-06 در مسیر proxy ناقص است (در next.config درست کار می‌کند). fail-closed است (امن، ولی عملکرد می‌شکند). راه‌حل: مقایسهٔ exact الگو با originHost + strip-scheme در parse env | **NEW-ISSUE** |
| F-2 | 🟡 متوسط (قبل از زرین‌پال live) | `src/providers/payment/zarinpal.ts:172-173` | **SEC-12 ناقص در دیپلوی واقعی: fallback مبلغ verify به echo ورودی.** اگر پاسخ verify v4 زرین‌پال فیلد `amount` را برنگرداند (در مستندات PG v4 تضمین‌شده نیست)، `verifiedAmountIrt = input.amountIrt` → تطبیق مبلغ دوباره no-op مثل قبل از SEC-12 — بی‌صدا. نیاز: تست سندباکس + در نبود `amount` حداقل لاگ بلند/سیاست صریح | **PARTIAL** |
| F-3 | 🟡 متوسط (کلاس FS-1 — نادر اما مادی) | `src/core/commerce/payment-service.ts:133-140` | **callback دیرهنگام بعد از fail: پولِ گرفته‌شده بدون مسیر می‌ماند.** اگر verify اول با خطای گذرا/قطعی درگاه fail شود (failPayment ثبت می‌شود) و پول واقعاً کم شده باشد، callback بعدی early-return می‌کند («قبلاً بسته شده») بدون verify مجدد و بدون refund؛ refund-service هم فقط PAID/PARTIALLY_REFUNDED را می‌پذیرد (refund-service.ts:79-91) → ادمین مسیر درسیستمی ندارد. FS-1 فقط باریکهٔ claim-lost همزمان را بست. پیشنهاد: در status=FAILED یک verify مجدد idempotent (کد 101) و در موفقیت → مسیر refundRacedPayment | **PARTIAL** (فیکس FS-1) |
| F-4 | 🔵 کم | `src/store/cart-store.ts:139-147` | **BUG-07 فقط در addLine بسته شد؛ updateQuantity هنوز خط صفرتایی می‌سازد:** اگر موجودی بعد از افزودن به صفر برسد (`maxStock=0`) و کاربر دکمهٔ + را بزند → `Math.min(2,0)=0` → خط qty=0 (شبح) برمی‌گردد؛ همان گیج‌کنندگی چک‌اوت که BUG-07 می‌بست. ریسک مالی ندارد (اعتبارسنجی سروری) | **PARTIAL** (BUG-07) |
| F-5 | 🔵 کم | `src/app/account/actions.ts:181-208` | **UX-02/BUG-12 نیمه‌اعمال:** هندل ZodError→پیام فیلد-محور فقط در `createAddressAction` (171-175) است؛ در `updateAddressAction`/`deleteAddressAction` ZodError هندل نشده → خطای generic («ویرایش آدرس ناموفق بود») یا استثنای action؛ فرم ویرایش همان پیام فیلد-محور را نمی‌گیرد | **PARTIAL** (UX-02) |
| F-6 | 🔵 کم | `src/app/account/wishlist-actions.ts:45-52` + `src/store/wishlist-store.ts:12-18` | **دو لبهٔ UX-03:** (۱) سقف ۲۰۰ در مهاجرت روی مجموع اعمال نمی‌شود — `slice(0,200)` فقط روی لیست ورودی است؛ کاربر با ۱۵۰ ردیف موجود + ۲۰۰ مهاجرت → ۳۵۰ ردیف (ناسازگار با «سقف ۲۰۰»). (۲) `serverToggle` پاسخ `{ok:false,message}` را می‌بلعد (`.catch(()=>{})` و بدون بررسی ok) — ردشدن سمت سرور (مثلاً سقف) بی‌صدا است و استور محلی از سرور واگرا می‌ماند تا هیدریشن بعدی | **PARTIAL** (UX-03) |
| F-7 | 🔵 کم (معنایی) | `src/providers/payment/zarinpal.ts:194-203` | **coupling فلگ دمو با refund واقعی:** `ALLOW_MOCKS_IN_PRODUCTION=1` گارد refund زرین‌پال را هم باز می‌کند حتی بدون `ZARINPAL_REFUND_ENABLED=1`. در سناریوی «دمو با مرچنت واقعی» استرداد خودکار بدون فلگ اختصاصی فعال می‌شود. پیشنهاد: شرط refund فقط `ZARINPAL_REFUND_ENABLED` یا صریحاً provider=mock | **NEW-ISSUE** |
| F-8 | 🔵 نیت | `tests/integration/sec-hardening.test.ts:245` | عنوان تست «کوکی اثبات درست (sha256 authority)» کهنه است — بدنه از `paidProofValue` (HMAC) استفاده می‌کند. تست صریحِ «کوکی قدیمی `sha256(authority)` باید رد شود» اضافه شود تا گذار INFRA-09 قفل شود | **PARTIAL** (تست) |
| F-9 | 🔵 نیت | `src/proxy.ts:70` | هدر `x-nonce` روی request ست می‌شود ولی مصرف‌کننده‌ای در src ندارد (مکانیزم nonce همان هدر CSP روی request است) — بی‌ضرر؛ یا حذف شود یا کامنت شود | **NEW-ISSUE** (خرده) |

**شمارش:** 🔴 بحرانی ۰ · 🟠 بالا ۰ · 🟡 متوسط ۳ (F-1، F-2، F-3) · 🔵 کم/نیت ۶ (F-4 تا F-9)

---

## ۴) رأی نهایی

**PASS** — با سه تعقیب 🟡 غیربلوکه‌کننده (هر سه سناریوی دیپلوی/گذار هستند، نه رگرسیون رفتار فعلی):
۲۴۷/۲۴۷ مستقل سبز · typecheck/lint صفر · هیچ رگرسیونی در گاردهای فاز ۱ · BUG-06/08، INFRA-04/09 و لایه‌بندی CSP همگی FIXED-CONFIRMED.

**گام بعدی پیشنهادی (اولویت‌دار):**
1. F-1 — تکمیل `isAllowedOrigin` برای الگوهای exact قبل از تنظیم `SERVER_ACTIONS_ALLOWED_ORIGINS` در دیپلوی (یک بازبینی ۱۰ خطی + تست unit).
2. F-2 — تست سندباکس زرین‌پال برای حضور/غیاب `amount` در verify + سیاست fail-closed.
3. F-3 — verify مجدد idempotent در status=FAILED برای بستن کامل کلاس FS-1 (+ تست).
4. F-4 تا F-6 — سه فیکس کوچک UX (هر یک <۱۵ خط) به بک‌لاگ فاز بعد.
