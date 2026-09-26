# گزارش بازبینی بک‌اند فاز ۲ — Task 60-be (نقش: متخصص بک‌اند/دیتابیس)

> **دامنه:** صحت همزمانی و دیتا در کامیت `e2791da` (BUG-01..05 + ۱۷ تست پذیرش)
> **روش:** خواندن کامل diff + کل فایل‌های سرویس مرتبط (coupon/checkout/payment/inventory/order/refund/state-machines/mappers + actions) + کوئری فقط-SELECT روی DB + اجرای unit tests
> **محدودیت رعایت‌شده:** هیچ فایل سورس ویرایش نشد، هیچ commit/push، هیچ تغییر داده (فقط SELECT)، سرور ری‌استارت نشد
> **شواهد اسکرچ:** `qa-reports/tmp-60/` (کوئری‌های فقط-خواندنی)

---

## رأی نهایی: **PASS** — پنج فیکس فاز ۲ درست و همگرا هستند؛ ۱۰ یافتهٔ ثبت‌شده همگی 🔵/🟡 و بلوکه‌کننده نیستند (۶ قلم پیشنهاد فاز ۳)

---

## بخش ۱ — پاسخ تحقیقی به ۷ سؤال بازبینی

### ۱) قفل کوپن (BUG-01) — الگو صحیح است ✅

- `coupon-service.ts:125` — `SELECT "id" FROM "Coupon" WHERE "id"=$ FOR UPDATE` در ابتدای `consumeCouponInTx`. همهٔ مصرف‌های همزمانِ یک کوپن از این نقطه سریال می‌شوند.
- **بازخوانی بعد از قفل کافی است؟** بله — `coupon-service.ts:128-130` بعد از قفل `findUnique` می‌زند؛ در isolation پیش‌فرض READ COMMITTED و با قفل در اختیار، وضعیت خوانده‌شده تا انتهای tx پایدار است (هیچ tx دیگری نمی‌تواند ردیف را بین خواندن و UPDATE تغییر دهد چون خودش روی همان قفل می‌ماند).
- **تعامل دو گارد:** گارد اول (usageLimit شرطی، `:145-151`) و گارد دوم (شمارش perUser زیر قفل، `:164-176`) زیر همان قفل‌اند. اگر perUser بعد از increment ظرفیت کلی throw کند، کل tx چک‌اوت rollback می‌شود و usedCount هم برمی‌گردد — بدون واگرایی. ترتیب «increment ظرفیت → چک per-user» از نظر دیتا بی‌ضرر است چون داخل همان tx است.
- **تحلیل ددلاک (سؤال اصلی):** ترتیب قفل در کل کدبیس یکنواخت است:
  - checkout: قفل واریانت‌ها (`reserveVariant` — UPDATE خام روی Variant، `checkout-service.ts:295` داخل حلقه `:294`) ← **سپس** قفل Coupon (`:306`). یعنی کد عملاً «واریانت قبل از کوپن» دارد.
  - تنها دو سایت `FOR UPDATE` در کل src: ردیف Order در `refund-service.ts:60` و ردیف Coupon در `coupon-service.ts:125`. refund بعد از قفل Order سراغ Variant/Coupon نمی‌رود → هیچ چرخهٔ قفل بین «چک‌اوت A با کوپن X» و «چک‌اوت B با کوپن Y روی واریانت مشترک» شکل نمی‌گیرد (هر دو اول واریانت می‌گیرند، پس روی واریانت سریال می‌شوند و هرگز هر دو به فاز کوپن نمی‌رسند).
  - **یافتهٔ حاشیه‌ای (F-1):** ترتیب قفل واریانت‌ها *داخل* یک چک‌اوت، ترتیب خط‌های سبد کاربر است (`items` از `wanted.values()`، `checkout-service.ts:294`)؛ دو سبد معکوس روی دو واریانت مشترک می‌توانند روی خودِ واریانت‌ها ددلاک کنند (PG یکی را با 40P01 می‌کُشد → 500 برای آن کاربر). بدون خرابی دیتا؛ پیش‌فاز ۲؛ راه‌حل: مرتب‌سازی items بر اساس variantId قبل از رزرو یا نگاشت خطای ددلاک به پیام ساختاریافته + retry.
- نکتهٔ عملکردی: کوپن داغ نقطهٔ سریال‌سازی global برای همهٔ چک‌اوت‌های همان کد است — در مقیاس فعلی با timeout 15s قابل قبول.

### ۲) failPayment (BUG-03) — همگرا و idempotent است ✅

- **claim موفق ولی لغو شرطی ۰ ردیف:** `payment-service.ts:330-333` آپدیت شرطی `where status: "PENDING"` بدون throw. تنها حالت ۰-ردیف، لغو/پیش‌رفتگی همزمان سفارش است (PROCESSING فقط از مسیر confirm می‌آید که خودش اول Payment را PAID کرده — پس در آن حالت claim فیل می‌شود). حالت نهایی در همهٔ ترتیب‌ها سازگار است: `Order CANCELLED + Payment FAILED`.
- **رفتار releaseReservation روی snapshot قدیمی:** snapshot رزروها قبل از tx خوانده می‌شود (`:312-315`) اما `releaseReservation` خودش claim اتمیک `updateMany where status ACTIVE` دارد (`inventory-service.ts:98-102`)؛ اگر رزرو همزمان توسط worker انقضا یا لغو ادمین آزاد شده باشد → count=0 → no-op. دفاع دولایه صحیح است — double-decrement ناممکن.
- **callback تکراری همزمان دوم:** اگر وضعیت را FAILED دیده باشد → زودعود در `:316`؛ اگر PENDING دیده باشد، claim آن روی قفل ردیف بلاک می‌شود، بعد از commit اولی دوباره WHERE را ارزیابی می‌کند → 0 ردیف → return داخل tx (کامیت خالی، بدون اثر). نه رخداد تکراری PaymentFailed نه double-release. درست است.
- **رقابت confirm×fail:** هر دو claim شرطی روی همان فیلد status — فقط یک برنده؛ بازنده بر اساس وضعیت تازه همگرا می‌شود (`:180-188` در confirm، `:327` در fail).

### ۳) state-machines + order-service (BUG-04) ✅ با دو کورراه ثبت‌شده

- `state-machines/index.ts:188-212` — `filter(from,to)` سپس تطبیق actor: کاندیدا خالی → 409، actor ناهم‌خوان → 403. لغو ادمین از PENDING حالا مجاز است و تست unit آن را پوشش می‌دهد (`tests/unit/state-machines.test.ts:73-104`).
- **permission کجا چک می‌شود؟** در لایهٔ action: `orders/actions.ts:39,74` → `withAdminAction(PERMISSIONS.ordersUpdate, …)` → `requireAdminContext(permission)` (`action-helpers.ts:58`)؛ `PERMISSIONS.ordersUpdate = "orders.update"` (`permissions.ts:19`). فیلد `adminPermission` در قواعد ماشین **فقط مستندسازی** است — ماشین خودش آن را enforce نمی‌کند (کامنت `:30` هم همین را می‌گوید). فعلاً تک‌مصرف‌کننده است؛ رأی: قابل قبول (F-10 اطلاعاتی).
- **کورراه‌ها (تأیید سؤال):** گذار `DELIVERED→RETURN_REQUESTED` با actor=customer (`:88-93`) **هیچ مسیر consumer ندارد** — `transitionOrder` بازیگر را hardcode "admin" کرده (`order-service.ts:188`) پس ادمین هم 403 می‌خورد؛ دکمهٔ UI ادمین `canReturn = status==="RETURN_REQUESTED"` (`orders-manager.tsx:203,362-367`) روی وضعیتی است که هرگز ساخته نمی‌شود → شاخهٔ مرده و `RETURNED` عملاً غیرقابل‌دسترس. گذار customer `PENDING→CANCELLED` هم هیچ caller با actor=customer ندارد. هم‌خانوادهٔ BUG-15 (بازگشت کالا سیم‌کشی نشده) → F-4.
- نکتهٔ جانبی: مسیرهای system (confirm/fail در payment-service) سفارش را با updateMany مستقیم جلو می‌برند و از ماشین عبور نمی‌کنند — شرطی و امن، ولی «تک‌منبع حقیقت» فقط برای مسیرهای انسانی برقرار است.

### ۴) mappers و سازگاری stock=0 ✅ با یک ناسازگاری فیلتر

- فیکس BUG-05 درست است و دولایه: مپر فقط فعال‌ها را می‌شمارد (`mappers.ts:175,193-196`) و `productInclude` در repository هم از ابتدا `where: { isActive: true, deletedAt: null }` دارد (`product-repository.ts:22-23`). همه-غیرفعال → `price=0, stock=0, colors/sizes=[]`. تست‌های واحد پوشش کامل دارند (`mappers.test.ts:193-233`).
- پایین‌دست سازگار: صفحهٔ محصول `stock===0` → دکمهٔ disable + «ناموجود» (`product-info.tsx:188-191`)، JSON-LD `InStock` شرط `stock>0` (`json-ld.tsx:85`)، کارت فقط بج کمبود برای `0<stock` (`product-card.tsx:146`).
- **یافته (F-5، مهم‌ترین یافتهٔ این بازبینی):** فیلتر «فقط کالاهای موجود» در DB با مدل صادق جدید ناسازگار است — `product-repository.ts:109` شرط `variants: { some: { stock: { gt: 0 } } }` است که **نه isActive/deletedAt می‌بیند نه reserved**: محصولِ همه-واریانت-غیرفعال (stock رکورد >0) یا کاملاً رزروشده (available=0) در نتیجهٔ «فقط موجود» می‌آید در حالی که stock نمایشی‌اش 0 است. پیشنهاد: فیلتر درون‌حافظه‌ای روی `p.stock > 0` (هم‌تراز بقیهٔ فیلترهای in-memory در همان تابع).
- **یافتهٔ UI (F-6):** کارت فروشگاه برای همین محصولات `formatPrice(0)` («۰ تومان») نشان می‌دهد و بج «ناموجود» ندارد (`product-card.tsx:118-123`) — قبل از فیکس قیمت جعلی ۷۴۵هزار بود، الان صفرِ بی‌معنا؛ فاز ۴ باید بج ناموجود/مخفی‌سازی قیمت در کارت اضافه کند (هم‌خانوادهٔ BUG-07 سبد).

### ۵) کیفیت تست رقابت کوپن — واقعی اما با دو نقطه‌ضعف مستند

- **پول اتصال:** تست ۱۰ interactive tx موازی با `Promise.allSettled` می‌سازد (`coupon-concurrency.test.ts:81-87`). Prisma pool پیش‌فرض `num_cpus×2+1` است؛ در این سندباکس ۲ vCPU → سقف ۵ اتصال همزمان و ۵ tx صف می‌شوند (maxWait پیش‌فرض 2s، txها میلی‌ثانیه‌ای و `synchronous_commit=off` → بدون خطای صف). یعنی رقابت **واقعاً ۵-راهه** است، نه ۱۰-راهه — اما برای فشار روی قفل ردیف/شمارش perUser کافی است.
- **نقطه‌ضعف ۱ (ذاتی):** تست stress است نه proof — بدون `FOR UPDATE` احتمال شکستش بالا ولی قطعی نیست؛ اعتبار واقعی از دو اجرای سبز پشت‌سرهم می‌آید.
- **نقطه‌ضعف ۲ (ساختنی):** اگر روزی `connection_limit=1` در DATABASE_URL بنشیند، تست بی‌صدا سریال می‌شود و حتی کدِ قبل از فیکس هم سبز می‌ماند. پیشنهاد: در تست، datasource URL با `?connection_limit=8` صریح ساخته شود تا همزمانی ساختاری تضمین شود (F-8).
- تست‌های payment-fail-race درست‌طرح‌اند: پذیرش فقط CONFLICT برای بازندهٔ لغو (`:122-127`)، دقیقاً یک رخداد Outbox، reserved=0، idempotency دوم (`:160-178`)، رقابت claim تأیید/شکست (`:180-198`).
- **یافتهٔ بهداشت (F-7):** afterAll تست کوپن فقط پیشوند RUN *جاری* را پاک می‌کند (`:223`) برخلاف تست payment که بقایای بین-رانی را با پیشوند پاک می‌کند (`payment-fail-race.test.ts:203-206`). نتیجه در DB زنده: **۳۰ کوپن باقی‌ماندهٔ تست `CC-*`، همگی isActive=true با usedCount 1-2 و صفر Redemption** (شواهد بخش ۲). حذف کاربر با پیشوند تلفن `0913/0916` هم الگوی پرخطر روی DB مشترک است.

### ۶) خطر Oversell — بسته است ✅

- `reserveVariant` گارد INACTIVE در خود SQL دارد: `isActive = true AND deletedAt IS NULL` + محصول `ACTIVE` و حذف‌نشده (`inventory-service.ts:38-48`) → رزروِ واریانت غیرفعال حتی اگر UI گول بخورد، در سطح DB رد می‌شود.
- لایهٔ قبل از آن، چک‌اوت فقط واریانت‌های فعال را resolve می‌کند (`checkout-service.ts:131-137`) → خط همه-غیرفعال زودتر با OUT_OF_STOCK می‌میرد. با stock نمایشی 0 (BUG-05) مسیر رزرو همان واریانت‌ها را رد می‌کند — وعدهٔ UI و گارد رزرو هم‌راستا هستند.

### ۷) دیتای فعلی کوپن — صفر کوپن واقعی؛ ۳۰ لاشهٔ تست

کوئری فقط-SELECT (اسکرچ `tmp-60/coupons-count.ts`):
- کل Coupon = **۳۰** — همه با الگوی `CC-<timestamp>-XXXXXX` (درون-تست ساخته می‌شوند، seed هیچ کوپنی ندارد).
- همه: `perUserLimit=1`, `usageLimit=null`, `isActive=true`, `usedCount∈{1,2}`؛ جدول `CouponRedemption` **خالی**.
- **اثر ADR سبد گمنام روی دیتای فعلی: صفر** — هیچ کوپن واقعی/seed موجود نیست؛ هیچ مشتری فعلی تحت تأثیر پیام جدید مهمان نیست.
- اما همین لاشه‌ها سه پیام دارند: (۱) شاهد کافی برای gap پاک‌سازی F-7؛ (۲) کوپن‌های Active زنده با ۱۰٪ تخفیف و کد رندم در DB فروشگاهی باقی مانده؛ (۳) usedCount>0 با صفر Redemption = عدم تقارن کش/حقیقت که در دیتای واقعی هرگز نباید دیده شود. پیشنهاد پاک‌سازی یک‌بارهٔ `CC-*` به مالک دیتا (خارج از دستور من).

---

## بخش ۲ — فهرست یافته‌ها (فایل:خط · شدت · شواهد)

| # | شدت | یافته | محل | شواهد |
|---|------|-------|-----|-------|
| F-1 | 🔵 پایین | ترتیب قفل واریانت‌ها پیرو ترتیب سبد کلاینت است → ددلاک 40P01 ممکن بین دو چک‌اوت سبد-معکوس؛ PG یکی را می‌کُشد (بدون خرابی دیتا) — خطای خام 500 | `checkout-service.ts:294-301` | تحلیل ترتیب قفل؛ فقط دو سایت FOR UPDATE در src |
| F-2 | 🟡 متوسط | تخفیف از خواندن **بدون قفل** کوپن محاسبه می‌شود و consume فیکسِ بازخوانی فقط dates/isActive/usageLimit/perUser را چک می‌کند نه value/maxDiscount/minSubtotal → ویرایش همزمان ادمین = سفارش با تخفیف کهنه | `checkout-service.ts:219-245` · `coupon-service.ts:128-176` | مقایسهٔ مجموعهٔ گاردهای دو تابع؛ هم‌خانوادهٔ BUG-08 (سه فرمول موازی — فاز ۳) |
| F-3 | 🔵 پایین | لغو ادمینِ سفارشِ دارای پرداخت PENDING، ردیف Payment را PENDING رها می‌کند (بدون sweeper) — تا callback بعدی/بی‌نهایت | `order-service.ts:63-82` (بستن Payment در همان tx انجام نمی‌شود) | startPayment رزومه را با `status!==PENDING` می‌بندد ولی ردیف باز می‌ماند |
| F-4 | 🟡 متوسط | گذارهای بدون consumer: `DELIVERED→RETURN_REQUESTED` (customer) و لغو customer — ادمین با actor=admin روی RETURN_REQUESTED خودش 403 می‌خورد؛ دکمهٔ UI روی وضعیت غیرقابل‌رسیدن = شاخهٔ مرده؛ RETURNED غیرقابل‌دسترس | `state-machines/index.ts:88-93` · `order-service.ts:188` · `orders-manager.tsx:203,362-367` | grep «RETURN_REQUESTED/cancelOrder» در src |
| F-5 | 🟡 متوسط | فیلتر «فقط کالاهای موجود» ناقص: `stock>0` بدون isActive/deletedAt/reserved → محصول stock-نمایشی-0 در نتایج «موجود» می‌آید | `product-repository.ts:109` | تقابل با `mappers.ts:175,193-196` و `productInclude:22-23` |
| F-6 | 🔵 پایین | کارت محصول برای همه-غیرفعال: «۰ تومان» بدون بج ناموجود (صداقت کارت پس از BUG-05) | `product-card.tsx:118-123,146` | کد کارت؛ صفحهٔ محصول درست است |
| F-7 | 🟡 متوسط | پاک‌سازی تست کوپن فقط RUN جاری → ۳۰ کوپن `CC-*` فعال با usedCount 1-2 و صفر Redemption در DB + حذف کاربر با prefix تلفن (الگوی پرخطر) | `coupon-concurrency.test.ts:214-224` | کوئری زندهٔ DB (بخش ۷)؛ تقابل با الگوی درست `payment-fail-race.test.ts:203-206` |
| F-8 | 🔵 پایین | تست رقابت به pool پیش‌فرض (۵ در این ماشین) اتکا دارد؛ `connection_limit=1` آینده تست را کور می‌کند — pool صریح در URL تست شود | `coupon-concurrency.test.ts:17-19` | nproc=2 → pool=2×2+1=5؛ تحلیل بخش ۵ |
| F-9 | 🔵 پایین (تصمیم کسب‌وکاری) | سهمیهٔ کوپن (usageLimit+perUser) با سفارش رهاشدهٔ PENDING/لغوشده برای همیشه می‌سوزد — هیچ مسیر برگشت سهمیه/usedCount وجود ندارد؛ باید ADR شود | `order-service.ts` (بدون decrement) · grep usedCount | worker موجود فقط رزرو را منقضا می‌کند (`expire-reservations.ts`) |
| F-10 | 🔵 اطلاعاتی | `adminPermission` در قواعد ماشین enforce نمی‌شود (فقط action-layer) و مسیرهای system از updateMany مستقیم عبور می‌کنند — تصمیم مستند کامنت `:30`؛ رأی قابل قبول | `state-machines/index.ts:30,44` · `payment-service.ts:194,330` | خواندن کد |

** موارد تأییدشده (بدون یافته):** قفل+بازخوانی کوپن ✅، ترتیب global قفل‌ها بدون چرخه ✅، idempotency و همگرایی failPayment ✅، دفاع دولایهٔ releaseReservation ✅، تفکیک 409/403 ماشین ✅، RBAC اکشن ادمین ✅، BUG-05 دولایه + تست‌های میخ ✅، گارد INACTIVE در رزرو (ضد oversell) ✅، unit 180/180 در این بازبینی (بدون نوشتن DB).

---

## بخش ۳ — اقدامات پیشنهادی (خارج از اختیار این تسک؛ برای فاز ۳)

1. **F-2 + BUG-08 با هم حل شوند:** مبنای discount به «کوپنِ بازخوانی‌شده زیر قفل» منتقل شود (خروجی `consumeCouponInTx` کوپنِ نهایی بدهد یا discount را برگرداند) — با ادغام سه فرمول در `computeDiscount`.
2. **F-5:** فیلتر in-memory `p.stock > 0` برای onlyAvailable (یا شرط DB هم‌تراز با isActive/reserved).
3. **F-7:** cleanup بین-رانی با پیشوند `CC-` در afterAll تست کوپن + پاک‌سازی یک‌بارهٔ ۳۰ لاشهٔ فعلی توسط مالک دیتا.
4. **F-8:** `connection_limit=8` صریح در URL تست کوپن.
5. **F-4/BUG-15:** وقتی مسیر مرجوعی مشتری ساخته شد، `assertOrderTransition(..., "customer")` از همان مسیر صدا زده شود؛ تا آن‌هنگام دکمهٔ `canReturn` ادمین حذف/غیرفعال شود.
6. **F-9:** ADR «سوزاندن سهمیهٔ کوپن در لغو/رهاشدگی» یا policy بازگرداندن سهمیه — تصمیم صریح.
7. **F-1/F-3:** مرتب‌سازی items قبل از رزرو (رفع ددلاک ترتیبی) و بستن Paymentهای PENDING در tx لغو ادمین.

---

## پیوست — محیط و محدودیت‌های اجرای این بازبینی

- unit tests اجرا شد: `bun test tests/unit` → **180 pass / 0 fail** (546 expect) — بدون نوشتن DB.
- integration ها توسط این ایجنت اجرا نشد (احترام به قید «فقط SELECT» روی داده — اجرای آن‌ها ردیف می‌سازد/پاک می‌کند)؛ ادعای 245/245 در worklog Task 60 ثبت است و ردیف‌های باقی‌ماندهٔ CC-* در DB خود شاهد اجرای مکرر آن‌هاست.
- کوئری‌های DB این بازبینی فقط-SELECT بودند: `tmp-60/coupons-look.ts` و `tmp-60/coupons-count.ts`.
