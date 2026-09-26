# گزارش بازبینی فول‌استک فاز ۲ — Task 60-fs

- **بازبین:** Agent 60-fs (نقش: بازبین فول‌استک)
- **موضوع:** بازبینی سخت‌گیرانهٔ commit `e2791da` (BUG-01..05 + ۱۷ تست پذیرش) — HEAD فعلی، working tree تمیز (به‌جز qa-reports/tmp-60)
- **روش:** دیفای کامل commit + خواندن کل فایل‌های تغییر یافته + ردیابی همهٔ callerها با grep + اجرای مستقل تست‌ها + بررسی بهداشت DB بعد از ران
- **اجراهای مستقل من:** unit **180/180** ✅ · integration **65/65** ✅ (شامل دو فایل جدید **9/9**) · typecheck: صفر خطا در src/tests · جمع ۲۴۵/۲۴۵ = ادعای Task 60 **تأیید شد**
- **بهداشت DB پس از ران من:** `cc-*`=0 · `pfr-*`=0 · CouponRedemption=0 · reserved>0=0 · Outbox تازه=0 → فیکسچرهای فاز ۲ خودشان را کامل پاک می‌کنند (دو سفارش بدون‌کاربر باقی‌مانده متعلق به ران‌های زندهٔ خود Task 60 در ساعت ۱۲:۴۳–۴۴ است، نه تست‌های جدید)

---

## بخش ۱ — رأی پنج فیکس اصلی

### 1. BUG-01 — قفل FOR UPDATE کوپن — رأی: ✅ FIXED-CONFIRMED (🔵)

- **شواهد:** `src/core/commerce/coupon-service.ts:125` قفل `SELECT "id" FROM "Coupon" … FOR UPDATE` + بازخوانی در :128-130. نقطهٔ حیاتی: **تنها نویسندهٔ `CouponRedemption` در کل کدبیس همین تابع است** (grep: فقط `coupon-service.ts:178`) و هر مصرف‌کننده باید اول قفل ردیف کوپن را بگیرد → شمارش `userId IS NULL / =user` در :165-167 زیر قفل، نسبت به هر رقابتی بسته است. قفل تا پایان tx نگه داشته می‌شود، پس تراکنش بعدی حتماً ردیف commit‌شدهٔ قبلی را در count می‌بیند (ReadCommitted کافی است).
- **مرز تراکنش / ددلاک (پرسش چک‌لیست):** ترتیب قفل در tx چک‌اوت یک‌طرفه و بی‌چرخه است: قفل‌های ردیف Variant (در `reserveVariant` با UPDATE شرطی، checkout-service.ts:294-301) **همیشه قبل از** قفل Coupon گرفته می‌شوند؛ هیچ مسیری قفل کوپن را قبل از واریانت نمی‌گیرد (consumeCouponInTx اصلاً به Variant دست نمی‌زند) → ABBA ممکن نیست. هزینهٔ صف‌شدن: قفل فقط برای دنبالهٔ سبک tx نگه داشته می‌شود (count + insert + outbox — چند ms)؛ بخش سنگین (ساخت سفارش/رزروها) قبل از قفل است. و مهم‌تر: **tx چک‌اوت timeout صریح ۱۵ ثانیه دارد** (`checkout-service.ts:323` — `timeout: 15_000`)، پس نگرانی «timeout پیش‌فرض 5s با ۱۰ تراکنش صف‌شده» منتفی است (تستِ ۱۰-موازی خودش همین سناریو را در ~۱۹۰ms می‌گذراند).
- **تست واقعاً رقابتی است؟** بله — روی کد قدیمی (count-then-create بدون قفل) هر ۱۰ tx پیش از commit همدیگر count=0 می‌بینند → ۱۰ Redemption → assert `okCount===1` قرمز می‌شد. تست‌های BUG-02 (۳ مهمان) حتی بدون رقابت هم روی کد قدیمی قرمز می‌شدند (شرط `&& userId` مهمان را از سقف خارج می‌کرد). قدرت تشخیص (mutation-sensitivity) بالاست.
- نکتهٔ جانبی: اگر couponId ناموجود باشد، قفل هیچ ردیفی نمی‌گیرد ولی بلافاصله findUnique → null → COUPON_INVALID (:131) — مسیر امن.

### 2. BUG-02 — سبد گمنام مشترک مهمان — رأی: ✅ FIXED-CONFIRMED (🔵)

- **شواهد:** `coupon-service.ts:86-98` (evaluate) و :164-176 (consume) — شرط `&& userId` حذف؛ `userId: userId ?? null` درست `IS NULL` می‌سازد (اگر undefined پاس می‌شد Prisma فیلتر را نادیده می‌گرفت — از این تله رد شده‌اند). پیام مهمان شفاف و راهنما (:95 و :173).
- **تعامل onDelete:SetNull (پرسش چک‌لیست):** اسکیما `prisma/schema.prisma:423` تأیید می‌کند `user … onDelete: SetNull` → ردیف‌های کاربر حذف‌شده به سبد گمنام می‌ریزند و **در ADR کامنت هدر فایل صریحاً مستند شده** (`coupon-service.ts:22-25` — «سخت‌گیری عمدی»). مستندسازی درست، تصمیم دفاع‌پذیر (مسیر جایگزین تلفن قابل جعل بود).
- **call-site پیش‌نمایش:** `src/app/checkout/actions.ts:126` برای مهمان `null` می‌گذارد → پیش‌نمایش UI با مصرفِ نهایی هم‌قاعده است (دو مسیر واگرا نمی‌شوند).
- توازن تجاری تصمیم (یک مهمان سهمیهٔ همهٔ مهمان‌ها را می‌بلعد) در ADR ثبت شده — قابل قبول برای کوپن‌های perUserLimit.

### 3. BUG-03 — failPayment اتمیک — رأی: ✅ FIXED-CONFIRMED (🔵) + یک یافتهٔ مجاور 🟡 (بند ۶)

- **شواهد:** `payment-service.ts:320-327` claim اتمیک `updateMany {status: PENDING} → FAILED` بدون throw؛ `claimed.count===0` → بازگشت زودهنگام idempotent. لغو شرطی سفارش :330-333 (بدون P2025). Outbox مستقل از نتیجهٔ لغو :341-344. callback دوم در سطح :316 (`status !== "PENDING"` → return) زودعود می‌کند — تست دوم فایل، صفر رخداد مضاعف را اثبات می‌کند.
- **اسنپ‌شات کهنه رزروها:** failPayment رزروها را بیرون از tx خوانده (:312-315) ولی `releaseReservation` خودش claim اتمیک با قید `status: ACTIVE` دارد (`inventory-service.ts:96-115`) → اگر cancelOrder/worker زودتر رد شده باشند، اینجا no-op امن است؛ تست اول ران من: reserved نهایی=0 ✅.
- **تداخل با confirmPayment:** هر دو claim یکسان روی `status: PENDING` دارند → دقیقاً یک برنده. مسیر «confirm برنده ولی سفارش همزمان لغو» → `refundRacedPayment` (:225-231) و پوشش تست قدیمی `tests/integration/commerce-core.test.ts:444-469` سر جایش است.
- **مسیر Json متادیتا:** `Payment.metadata Json?` (schema.prisma:505) و **هیچ نویسندهٔ دیگری به این ستون ندارد** (zarinpal.ts:130 متادیتای درخواست درگاه است نه این ستون) → overwrite کل آبجکت فعلاً بی‌هزینه. تست `toHaveProperty("failReason")` آن را قفل می‌کند.
- **قدرت تشخیص تست رقابت:** روی کد قدیمی، در سناریوی برنده‌شدن cancelOrder، failPayment با P2025 reject می‌شد و assert `err.code === "CONFLICT"` (:122-127) قرمز می‌شد → تست باگ را واقعاً می‌گیرد، نه فقط مسیر خوش‌بینانه.

### 4. BUG-04 — ماشین وضعیت بازیگر-محور + تغذیهٔ order-service — رأی: ✅ FIXED-CONFIRMED (🔵)

- **شواهد:** `state-machines/index.ts:188-212` — `filter(from,to)` سپس تطبیق actor؛ candidates خالی → 409، actor نامطابق → 403 (تفکیک حفظ شده). ۵ تست unit جدید هر پنج حالت (admin/customer/system/403/409) را می‌پوشانند و روی کد قدیمی (`find` اولین rule) قرمز می‌شدند.
- **grep کامل callerها (پرسش چک‌لیست):** در src فقط سه فراخوانی `assertOrderTransition` باقی است — `order-service.ts:60` (actor از پارامتر الزامی opts)، :147 و :188 (admin صریح). **هیچ caller تولیدیِ `assertTransition` توپولوژیک قدیمی نمانده** — فقط تست قدیمی `commerce-core.test.ts:554-556` از آن استفاده می‌کند (export با برچسب «برای تست/لاگ» — dead-but-tested، قابل قبول؛ پیشنهاد: در فاز ۳ حذف یا تغییرنام به `assertTopology`).
- **سیم‌کشی ادمین:** `orders/actions.ts:47` actor:"admin"؛ UI پنل (`orders-manager.tsx:202`) لغو PENDING و PROCESSING را ارائه می‌دهد → باگ latent دقیقاً همان‌جایی که قرار بود باز می‌شد و الان باز می‌شود. UI هرگز RETURN_REQUESTED (گذار customer-only) را به ادمین نمی‌دهد → سخت‌گیری actor هیچ مسیر ادمین را نمی‌شکند.
- **BUG-11 (as never):** `order-service.ts:202` حالا `status: to` با تایپ `OrderStatus` — cast حذف شده ✅.
- `ORDER_TRANSITIONS` مشتق‌شده از جدول دامنه (order-service.ts:25-29) → دو جدول موازی حذف شد؛ واحد بودن منبع حقیقت واقعی است.

### 5. BUG-05 — حذف fallback واریانت غیرفعال — رأی: ✅ FIXED-CONFIRMED (🔵) + دو پیامد فرودست (بند ۶ و ۷)

- **شواهد:** `mappers.ts:181` — `activeVariants = variants` (فقط isActive && !deletedAt). سه تست unit جدید (همه-غیرفعال / deletedAt / میخ فعال+غیرفعال) روی کد قدیمی قرمز می‌شدند (stock=8 ≠ 0).
- **اثرو روی UI (پرسش چک‌لیست — grep کامل):** کارت محصول: بج «تنها N عدد» با `stock > 0` گارد دارد (product-card.tsx:146) → برای 0 رندر نمی‌شود؛ صفحهٔ محصول: دکمه با `stock === 0 → "ناموجود"` (product-info.tsx:191)؛ JSON-LD: `availability: OutOfStock` درست می‌شود (json-ld.tsx:84-87) ولی `price: 0` هم صادر می‌شود (product/[slug]/page.tsx:93) — «قیمت صفر» در structured data دادهٔ معیوب برای سئو است؛ sitemap بی‌تأثیر (slug-محور، مستقل از stock/price — sitemap.ts:31-34).

---

## بخش ۲ — یافته‌های جدید / پیامدهای فرودست

### 6. 🟡 NEW-ISSUE — پنجرهٔ «verify موفق ولی claim باخته» در confirmPayment: پولِ گرفته‌شده بدون مسیر بازپرداخت

- **کجا:** `src/core/commerce/payment-service.ts:176-188`
- **شواهد:** اگر بین verify موفق درگاه (:134-146) و claim (:176) یک failPayment همزمان claim را ببرد (مثلاً callback دوم با وضعیت متفاوتِ درگاه، یا مسیر «پنجره پرداخت منقضی شد» :166 که در لحظهٔ ابطال رزروها فعال می‌شود)، شاخهٔ `claimed.count===0` (:180-188) فقط `FAILED` برمی‌گرداند — در حالی که درگاه پول را گرفته. نتیجه: Payment=FAILED، سفارش CANCELLED، **هیچ رکورد Refund/رخداد بازپرداخت ساخته نمی‌شود** (مسیر `refundRacedPayment` فقط وقتی اجرا می‌شود که claim برده باشد ولی tx سفارش باخته باشد :225).
- **ارزیابی:** سطحِ این شاخه از قبل وجود داشت (فاز ۲ آن را نساخته) و failPaymentِ جدید خودش کاملاً همگراست؛ اما چون موضوع فاز ۲ «پول بی‌مسیر نمی‌ماند» است، این تنها پنجرهٔ باقی‌مانده است. احتمال کم (نیازمند دو callback واگرا یا انقضای رزرو در میانهٔ verify) ولی پیامد مالی مستقیم.
- **پیشنهاد (فاز ۳):** در شاخهٔ claim-باخته، اگر `verify.ok===true` بود به‌جای برگرداندن FAILED، به `refundRacedPayment` مسیر داده شود؛ تست سوم `payment-fail-race.test.ts:180-198` هم الان confirm واقعی را صدا نمی‌زند (فقط updateMany خام) — این سناریو تست‌پذیر است.

### 7. 🟡 NEW-ISSUE — ناسازگاری فیلتر «onlyAvailable» با تعریف جدید موجودی

- **کجا:** `src/lib/repositories/product-repository.ts:109`
- **شواهد:** فیلتر DB `variants: { some: { stock: { gt: 0 } } }` نه `isActive` و نه `deletedAt` و نه `reserved` را ملاک می‌گیرد. بعد از BUG-05، محصولی که همهٔ واریانت‌هایش غیرفعال است (stock=8) **از فیلتر «فقط موجودهارا» عبور می‌کند ولی با stock=0 و «۰ تومان» رندر می‌شود** — یعنی همان وعدهٔ کاذب که ADR 011 منع کرده، این‌بار در لایهٔ فیلتر. فیلترهای رنگ/سایز (:103-108) هم به واریانت غیرفعال match می‌شوند.
- **پیشنهاد:** هم‌ترازکردن where فیلتر با مپر: `variants: { some: { isActive: true, deletedAt: null, stock: { gt: 0 } } }` (و ترجیحاً شرط stock−reserved با SQL خام مثل reserveVariant).

### 8. 🟡 NEW-ISSUE — پاکسازی تست با پیشوند تلفن کاربر — خطر حذف داده در DB اشتراکی

- **کجا:** `tests/integration/coupon-concurrency.test.ts:221-222`
- **شواهد:** `db.user.deleteMany({ where: { phone: { startsWith: "0913" } } })` (و 0916) **هر کاربری** در DB با این پیشوند را حذف می‌کند — نه فقط کاربرانِ ساختهٔ تست. DB فعلی واقعاً کاربران OTP واقعی دارد (0932…)؛ اگر QA با شمارهٔ 0913/0916 وارد شود، حسابش (و با SetNull شدن سفارش‌هایش) نابود می‌شود. در تضاد با درس ثبت‌شدهٔ خود Task 60 («sku یونیک در مقیاس ران‌ها») است — کاربران وسط فایل بدون push به `cleanupIds` رها شده‌اند.
- **پیشنهاد:** آرایهٔ `cleanupIds.userIds` مثل orderIds پر شود؛ deleteMany پیشوندی حذف گردد. (بقیهٔ پاکسازی این فایل را ردیابی کردم — کامل است: همهٔ Redemptionها با شاخهٔ orderId پوشش داده می‌شوند و کوپن‌ها با پیشوند `RUN`.)

### 9. 🔵 نکته — deleteMany پهنِ Outbox در پاکسازی payment-fail-race

- **کجا:** `tests/integration/payment-fail-race.test.ts:214-216`
- هر رخداد `PaymentFailed/OrderCancelled/OrderStatusChanged` در پنجرهٔ ۳۰ دقیقه را بدون قید payload/orderId حذف می‌کند — در dev سرور زنده داریم؛ رخداد سفارش واقعیِ همین نیم‌ساعت هم خورده می‌شود. محدود کردن where به `payload.paymentId`های ساختهٔ تست کافی است. (در ران من: Outbox تازه=0 — عملاً فعلاً بی‌ضرر.)

### 10. 🔵 نکته — typecheck حالا ۴ خطای اسکرچ دارد (نه ۳)

- **کجا:** `qa-reports/tmp-60/attack1-coupon.ts` (TS2867 — تایپ Bun) + سه خطای قدیمی tmp-56/57a/57b. src/tests همچنان صفر. ادعای worklog («۳ خطا») با فایل شواهدِ خودِ Task 60 قدیمی شده — و QA-HYG-01 (exclude کردن qa-reports از tsconfig/eslint) هنوز باز است؛ همین یک exclude هر پنج خطای این‌تبار را می‌بندد.

### 11. 🔵 نکته — دو خلافِ جاریِ پیش‌موجود که فاز ۲ تغییرشان نداد (ثبت برای فاز ۳)

- (الف) **تخفیف و minSubtotal بیرون از قفل:** در `checkout-service.ts:221-245` کوپن خوانده و تخفیف حساب می‌شود **قبل از** قفل :125؛ consumeCouponInTx هم minSubtotal را دوباره چک نمی‌کند → تغییر همزمانِ value/minSubtotal توسط ادمین می‌تواند snapshot تخفیف را از ردیف قفل‌شده جدا کند. پیش‌موجود و هم‌خانوادهٔ BUG-08 (سه نسخهٔ فرمول تخفیف) — پنجرهٔ باریک، ریسک پایین.
- (ب) ABBA ددلاک بین دو checkout که ترتیب واریانت‌های متفاوت دارند (ترتیب آیتم‌های سبد کاربر) — پیش‌موجود، مستقل از قفل کوپن؛ ترتیب واریانت بر اساس ورودی مرتب‌سازی می‌توانست ارزان بسته شود.

---

## بخش ۳ — سازگاری فاز ۱ (پرسش چک‌لیست)

- **گاردهای SEC-01..07 دست‌نخورده:** commit فقط ۱۲ فایل تغییر داده (stat) — هیچ فایلی از middleware / client-ip / rate-limit / csp / هدرهای امنیتی / گاردهای ادمین در آن نیست؛ worktree = HEAD. اجرای مجدد من: unit 180/180 (شامل sec-hardening و client-ip) و integration 65/65 سبز → گاردهای تست‌شدهٔ فاز ۱ سر جایشان‌اند. ✅
- رفتارهای امنِ متصل به همین فیکس‌ها: مالکیت startPayment (SEC-08 آینده) دست‌نخورده؛ کوکی اثبات و tracking مسیر خودشان را دارند؛ `failPayment` جدید گارد ورودی تازه‌ای نمی‌خواهد (authority از callback گارد‌شده می‌آید).

## بخش ۴ — جمع‌بندی رأی‌ها

| # | موضوع | شدت | رأی |
|---|-------|------|-----|
| 1 | BUG-01 قفل کوپن (+timeout 15s، ترتیب قفل بی‌چرخه) | 🔵 | FIXED-CONFIRMED |
| 2 | BUG-02 سبد گمنام + ADR/SetNull مستند | 🔵 | FIXED-CONFIRMED |
| 3 | BUG-03 failPayment اتمیک/idempotent | 🔵 | FIXED-CONFIRMED |
| 4 | BUG-04 ماشین وضعیت بازیگر-محور + تغذیهٔ واحد | 🔵 | FIXED-CONFIRMED |
| 5 | BUG-05 مپر صادق (با پیامد JSON-LD price:0) | 🔵 | FIXED-CONFIRMED |
| 6 | confirm-باخته بعد از verify موفق → پول بدون refund | 🟡 | NEW-ISSUE (فاز ۳) |
| 7 | فیلتر onlyAvailable ناهم‌تراز با تعریف موجودی | 🟡 | NEW-ISSUE (فاز ۳) |
| 8 | پاکسازی پیشوند تلفن کاربر در تست | 🟡 | NEW-ISSUE (فاز ۳) |
| 9 | deleteMany پهن Outbox در پاکسازی تست | 🔵 | NEW-ISSUE (خرد) |
| 10 | typecheck ۴ خطای اسکرچ (QA-HYG-01 باز) | 🔵 | ثبت |
| 11 | تخفیف/minSubtotal بیرون قفل + ABBA واریانت (پیش‌موجود) | 🔵 | ثبت (BUG-08 هم‌خانواده) |

**آمار یافته‌ها: 🔴 ۰ · 🟠 ۰ · 🟡 ۳ · 🔵 ۸ (۵ رأی FIXED-CONFIRMED + ۳ یافتهٔ جدید)**

## رأی نهایی: **PASS** ✅

هر پنج فیکس با شواهد ایستا + اجرای مستقل تست‌ها (۲۴۵/۲۴۵) + توان تشخیص واقعیِ تست‌ها (روی کد قدیمی قرمز می‌شدند) تأیید می‌شوند؛ معیارهای پذیرش tasks.md همگی برآورده‌اند و فاز ۱ دست‌نخورده است. سه 🟡 هیچ‌کدام رگرسیونِ فاز ۲ نیستند (دو مورد پیش‌موجود/مجاور و یک مورد بهداشت تست) و باید به بک‌لاگ فاز ۳ اضافه شوند: **FS-1** refund مسیر confirm-باخته، **FS-2** هم‌ترازی فیلتر onlyAvailable، **FS-3** پاکسازی id-محور کاربر در تست کوپن.
