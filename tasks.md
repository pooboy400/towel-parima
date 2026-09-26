# 📋 تسک‌لیست جامع پروژه پریمیما — امنیت + رساندن تجربهٔ سایت به ۱۰/۱۰

> **ساخته‌شده از:** گزارش‌های ۷ ساب‌ایجنت QA (تسک ۵۱ در worklog.md)
> **بازبینی‌شده (تسک ۵۳):** تطبیق یک‌به‌یک با هر ۷ گزارش — پوشش کامل؛ ۴ مورد ریز اضافه شد (BUG-14…16)
> منابع: `qa-reports/51a-programmer.md` · `51b-tester.md` · `51c-security.md` · `51d-hacker.md` · `51e-user1.md` · `51f-user2.md` · `51g-user3.md`
> **تاریخ:** ۱۴۰۵/۰۷/۰۴ (2026-09-26) · **وضعیت فعلی:** ۸.۵/۱۰ · **هدف:** ۱۰/۱۰

**راهنمای شدت:** 🔴 بحرانی · 🟠 بالا · 🟡 متوسط · 🔵 پایین · ⚪ سلیقه‌ای/آینده
**قانون:** هر تسک بعد از انجام، تیک بخورد و یک خط خلاصهٔ تغییر در worklog.md ثبت شود (قالب Task ID).

---

## ✅ چک‌لیست پیشرفت کلی

- [x] **فاز ۱ — امنیت حیاتی (بلوکه‌کنندهٔ go-live):** ۷ تسک + ۸ تعقیبی تست ۵۵ (Task 56) — کامل شد
- [x] **فاز ۲ — باگ‌های پول و دیتا:** ۵ تسک — کامل شد (Task 60)
- [x] **فاز ۳ — بهداشت کد و امنیت پایین‌تر:** ۱۸ تسک — کامل شد (Task 61 + بک‌لاگ باتری ۶۰: FS-1، ریت‌لیمیت callback، HEALTH-MON-01، CLIENT-IP-T1، CSP-N1، QA-HYG-01)
- [x] **فاز ۴ — UI/UX به سمت ۱۰/۱۰:** ۱۴ تسک — کامل شد (Task 62)
- [x] **فاز ۵ — سئو و اکسسوریلیتی:** ۴ تسک — کامل شد (Task 63)
- [ ] **فاز ۶ — زیرساخت و M6:** ۹ تسک (+INFRA-09 از CR-6/55-c)

---

# 🔐 فاز ۱ — امنیت حیاتی (قبل از go-live انجام شود)

| # | شدت | تسک | کجا (فایل) | شرح مشکل | راه‌حل | معیار انجام |
|---|-----|------|------------|-----------|--------|--------------|
| SEC-01 ✅ | 🟠 بالا | **authorize سطح صفحهٔ ادمین** — هر نقش ادمینی الان همهٔ صفحات را می‌بیند (پشتیبان → لیست کارکنان، audit با IP، پیام خصوصی مشتری‌ها) | `src/app/admin/(panel)/layout.tsx:18-21` + ۱۲ صفحهٔ داخلی (staff, audit, settings, orders, messages, products, reviews, journal, media, faq, categories, collections) | Layout فقط «لاگین بودن» را چک می‌کند؛ ماتریس §۶ سند فقط روی mutationها اعمال شده | نقشهٔ `route → permission` بساز و در بالای هر page سروری `requireAdminContext(permission)` بزن (یا در layout با جدول مسیرها)؛ منابع: `src/core/auth/permissions.ts` و `guard.ts` | کاربر با نقش SUPPORT_AGENT صفحهٔ /admin/staff و /admin/audit را نبیند (redirect/403)؛ تست read-matrix جدید در `tests/integration/rbac-matrix.test.ts` سبز شود |
| SEC-02 ✅ | 🟠 بالا | **منبع IP معتبر — TRUSTED_PROXY_CIDR** — با هدر جعلی X-Forwarded-For همهٔ سقف‌های نرخ دور زده می‌شوند (اثبات زنده: 429 → با XFF جعلی 200) | `src/lib/admin/action-helpers.ts:30-37` · `src/app/account/actions.ts:39-42` · `src/app/checkout/actions.ts:110,142` · `src/app/contact/actions.ts:23-30` · `src/app/api/search/route.ts:18-21` · `src/app/api/csp-report/route.ts:16` · `src/app/admin/login/actions.ts:49-53` | اولین عضو XFF بدون لیست سفید پروکسی معتمد گرفته می‌شود؛ در دسترسی مستقیم به سرور، هر درخواست IP جدید = bucket جدید | متغیر env `TRUSTED_PROXY_CIDR` (رنج Caddy)؛ IP فقط وقتی از XFF گرفته شود که peer در CIDR معتمد باشد، وگرنه remote address سوکت؛ یک تابع مشترک `getClientIp()` بساز و همهٔ ۸ سایت (۷ فایل) را به آن وصل کن | ۳۳ درخواست + XFF جعلی → همچنان 429؛ تست unit برای استخراج IP (با/بدون پروکسی) |
| SEC-03 ✅ | 🟠 بالا | **سقف مستقل per-email برای ورود ادمین** — brute-force رمز ادمین عملاً نامحدود است | `src/app/admin/login/actions.ts:50-56` | کلید سقف فعلی `admin-signin:{IP}:{email}` است و IP از XFF جعلی‌پذیر می‌آید؛ سقف per-email وجود ندارد | علاوه بر SEC-02، سقف دوم مستقل از IP: مثلاً ۱۰ تلاش/ساعت per email (کلید `admin-signin-email:{email}`)؛ بعد از سقف، پیام generic + تاخیر ثابت | ۱۱ بار رمز غلط با یک ایمیل (حتی با IPهای مختلف) → قفل؛ audit «rate-limited» ثبت شود |
| SEC-04 ✅ | 🟡 متوسط | **پیگیری سفارش بدون فاکتور دوم (IDOR)** — غریبه با حدس/نشت کد، مبلغ و اقلام سفارش دیگران را می‌بیند (اثبات زنده) | `src/app/order-tracking/page.tsx` · `src/core/commerce/checkout-service.ts:336-347` | صفحه فقط با کد ۱۰ رقمی کار می‌کند؛ بدون احراز، بدون rate-limit | فاکتور دوم الزامی: تطبیق کد + شماره موبایل (یا ۴ رقم آخر) + rate-limit per-IP روی همین صفحه (از قواعد موجود) | کد درست + موبایل غلط → «یافت نشد»؛ موبایل درست → نمایش؛ ۳۱ درخواست/دقیقه → 429 |
| SEC-05 ✅ | 🟡 متوسط | **سقف بدنهٔ /api/csp-report** — log flooding با بدنهٔ حجیم | `src/app/api/csp-report/route.ts:26-36` | `request.json()` کل بدنه را می‌خواند و خام لاگ می‌کند؛ با دور زدن سقف (SEC-02) دیسک/حافظه پر می‌شود | چک `Content-Length` (سقف ~۴KB) قبل از خواندن → بزرگ‌تر بودن: 204 بدون خواندن؛ رکوردهای خیلی بزرگ لاگ نشوند | POST با بدنهٔ 100KB → 204 و هیچ لاگی ثبت نشود؛ بدنهٔ سالم → مثل قبل |
| SEC-06 ✅ | 🟡 متوسط | **وصل‌کردن قواعد rate-limit بلااستفاده + پاکسازی health** | `src/core/rate-limit/policies.ts:28,36` (`publicApi`, `reviewSubmit` بلااستفاده) · `src/app/api/media/file/[...path]/route.ts` · `src/app/api/health/route.ts` | media-file و health و order-tracking هر hit یک کوئری DB/فایل دارند و سقف ندارند؛ health جزئیات خطای DB (`error.message`) را افشا می‌کند | قاعدهٔ `publicApi` را به media-file و health وصل کن؛ از پاسخ health فقط `status:"error"` برگردد بدون جزئیات؛ وقتی ثبت نظر عمومی ساخته شد `reviewSubmit` حتماً وصل شود | فشار روی /api/health → 429؛ خطای عمدی DB → پاسخ بدون جزئیات اتصال |
| SEC-07 ✅ | 🟡 متوسط | **گارد نشست روی صفحهٔ درگاه mock** — مبلغ و کد سفارش غریبه بدون احراز دیده می‌شود | `src/app/mock-gateway/route.ts` · `src/app/checkout/callback/route.ts` | تنها «احراز»، دانستن authority است؛ از لاگ سرور/Referer/تاریخچهٔ مرورگر مشترک قابل نشت است | نمایش مبلغ/کد سفارش فقط برای نشستِ مالک همان سفارش؛ مهمان/غریبه → صفحهٔ خطای generic؛ TTL authority کوتاه شود | /mock-gateway بدون کوکی مالک → بدون مبلغ و کد؛ پرداخت خودِ کاربر مثل قبل کار کند |

### 🧪 تعقیبی ۵۵ — یافته‌های تست سخت‌گیرانهٔ فاز ۱ (۴ ایجنت 55-a…d — همه در Task 56 رفع شد)

| # | شدت | تسک | کجا (فایل) | شرح مشکل | راه‌حل | معیار انجام |
|---|-----|------|------------|-----------|--------|--------------|
| F55-1 ✅ | 🟡 متوسط | **گیت داشبورد /admin (CR-1)** — KPI فروش/ارزش انبار (~۲۳۲میلیون) برای SUPPORT_AGENT دیده می‌شد | `src/app/admin/(panel)/page.tsx:52` | داشبورد بیرون read-map بود؛ فقط authenticate | ردیف `dashboard: [analyticsRead]` در نقشه + `requirePageAccess("dashboard")` | اثبات زنده: SUPPORT_AGENT → 307 به no-access؛ SUPER_ADMIN → 200؛ ردیف در read-matrix تست |
| F55-2 ✅ | 🟠 بالا (شرطی proxy) | **پارس واقعی IP با net.isIP (CR-2)** — `garbage::zz` و `1.2.3.4:80` به‌عنوان IP کلاینت پذیرفته می‌شد | `src/lib/client-ip.ts:112` | تنها گیتِ شکل، `includes(":")` بود | پارس با `net.isIP`؛ رد آدرس نامشخص (:: و 0.0.0.0) | تست unit: پنج شکل جعلی همگی null |
| F55-3 ✅ | 🟠 بالا (شرطی proxy) | **کانونی‌سازی باینری IPv6 (CR-3/A-4)** — `0:0:…:1` دور `::1/128` را می‌زد؛ CIDR IPv6 غیر /128 بی‌صدا دور ریخته می‌شد | `src/lib/client-ip.ts:105,63-65` | تطبیق رشته‌ای lowercase بدون پارس | تطبیق باینری BigInt + پشتیبانی کامل prefix 1-128 هر دو خانواده | تست unit: شکل معادل معتمد؛ `2001:db8::/32` رعایت می‌شود |
| F55-4 ✅ | 🟡 متوسط | **رد «/0» و اسلش انتهایی + هشدار بلند (CR-4)** — تایپ رایج trust-all بی‌صدا بود | `src/lib/client-ip.ts:60-73` | `Number("")===0` اسلش انتهایی را prefix صفر می‌کرد | رد صریح prefix 0/اسلش/زباله + `console.error` برای عضو دورریخته + مستند .env.example | تست unit: سه ورودی خراب → fail-closed؛ تست موجود /0 هم‌چنان سبز |
| F55-5 ✅ | 🟡 متوسط | **خواندن bounded در csp-report (CR-5)** — بدنهٔ chunked کامل در RAM بافر می‌شد | `src/app/api/csp-report/route.ts:41` | سقف 4KB فقط به هدر Content-Length اتکا داشت | خواندن از stream با سقف واقعی 4KB + cancel در سرریز | تست integration: chunked 100KB → 204 بدون لاگ؛ اثبات زنده: 204 در ۱۳ms |
| F55-6 ✅ | 🔵 پایین | **هدر Retry-After در 429ها (CR-7)** | `api/health` · `api/media/file` · `api/search` | limiter retryAfterMs را حساب می‌کرد ولی هیچ روتِی emit نمی‌کرد | یک‌خط در هر سه 429 | تست integration + اثبات زنده: درخواست #121 → 429 با retry-after: 58 |
| F55-7 ✅ | 🔵 پایین | **یکدست‌سازی گارد sms/notifications + scope=per-ip (CR-8/CR-10)** | `sms/page.tsx:22` · `notifications/page.tsx:23` · `admin/login/actions.ts` | sms به /admin ریدایرکت می‌کرد؛ notifications به‌جای no-access صفحة خطای 500-مانند؛ ردیف audit per-IP بدون scope | هر دو به نقشه + `requirePageAccess`؛ `after:{scope:"per-ip"}` | SUPPORT_AGENT → هر دو 200 (مجاز)؛ نقش بی‌مجوز → 307 no-access؛ account عمداً فقط-احراز مستند شد |
| F55-8 ✅ | 🟡 متوسط | **پوشش تست مستقیم SEC-05/06/07 (شکاف 55-d)** — سه فلگ هیچ تست مستقیمی نداشتند | `tests/integration/sec-hardening.test.ts` (جدید) | + کامنت صادقانه CR-9 در تست per-email | ۱۰ تست: سقف دقیق 120/30، bounded chunked، کوکی اثبات درگاه (۴ سناریو)، Retry-After | unit 172/172 · integration 56/56 صفر fail |

---

# 💰 فاز ۲ — باگ‌های منطقی پول و دیتا (اثبات‌شده)

| # | شدت | تسک | کجا (فایل) | شرح مشکل | راه‌حل | معیار انجام |
|---|-----|------|------------|-----------|--------|--------------|
| BUG-01 ✅ | 🟡 متوسط | **قفل رقابتی سقف perUserLimit کوپن (TOCTOU)** | `src/core/commerce/coupon-service.ts:135-145` | سقف کاربر با `count()` و بعد `create()` چک می‌شود؛ دو checkout همزمانِ یک کاربر هر دو رد می‌شوند (سقف ۱ → ۲ مصرف). برخلاف usageLimit که اتمیک است | قفل `SELECT … FOR UPDATE` روی ردیف Coupon در ابتدای `consumeCouponInTx` (همان الگوی `refund-service.ts:60`) یا unique index جزئی `(couponId, userId, n)` | تست integration: ۱۰ درخواست موازی با سقف perUser=۱ → دقیقاً ۱ Redemption |
| BUG-02 ✅ | 🟡 متوسط | **دور زدن perUserLimit توسط مهمان** — کوپن «یک‌بار برای هر کاربر» برای مهمان بی‌نهایت مصرف می‌شود | `src/core/commerce/coupon-service.ts:66,135` (`&& userId`) + `src/app/checkout/actions.ts:132-161` | checkout مهمان مجاز است ولی شرط سقف به userId وابسته است → مهمان با هر شماره/آدرس جدید دوباره مصرف می‌کند | تصمیم صریح: (الف) سقف مهمان روی `Order.phone` (count Redemption join با Order) یا (ب) کوپن‌های perUserLimit فقط برای کاربر لاگین؛ تصمیم را در کامنت/سند ADR ثبت کن | مهمان با ۳ شمارهٔ مختلف و سقف perUser=۱ → فقط ۱ مصرف موفق؛ تست integration |
| BUG-03 ✅ | 🟡 متوسط | **failPayment در رقابت با لغو → Payment برای همیشه PENDING می‌ماند** | `src/core/commerce/payment-service.ts:317-320` | `update` با where مرکب در نبود ردیف → P2025 → rollback کل tx → PaymentFailed به Outbox نمی‌رود و هر callback تکراری همان خطا را می‌دهد (همان باگِ Task 48 که فقط در confirmPayment رفع شد) | الگوی `updateMany` شرطی بدون throw (مثل confirmPayment)؛ release رزرو و Outbox مستقل از نتیجه ادامه یابد | تست: لغو همزمان سفارش × callback ناموفق → Payment FAILED ثبت و Outbox رخداد دارد؛ callback دوباره → بدون خطا |
| BUG-04 ✅ | 🟡 متوسط | **جدول گذار چند-بازیگر: لغو ادمین از PENDING با 403 رد می‌شود (اثبات probe)** | `src/domain/state-machines/index.ts:185` + قواعد 56-66 · دوگانگی با `src/core/commerce/order-service.ts:15` | `find` بازیگر را نادیده می‌گیرد و همیشه rule اول (customer) برمی‌گردد. فعلاً latent است ولی به محض اتصال طبق سند §۵ می‌شکند | `filter(from,to)` سپس تطبیق `actor`؛ candidates خالی → 409، وگرنه 403؛ `order-service` از همین جدول تغذیه شود (یک منبع حقیقت) | probe: `assertOrderTransition("PENDING","CANCELLED","admin")` → مجاز؛ تست unit جدید «admin cancel PENDING» |
| BUG-05 ✅ | 🟡 متوسط | **موجودی نمایشیِ مثبت برای محصولی که همهٔ واریانت‌هایش غیرفعال است (اثبات probe)** | `src/lib/repositories/mappers.ts:176,188-191` | fallback `activeVariants = p.variants` باعث می‌شود stock جمعِ واریانت‌های غیرفعال نمایش داده شود (۸) ولی رزرو با INACTIVE رد می‌شود — وعدهٔ کاذب UI (نقض روح ADR 011) | اگر واریانت هست ولی هیچ‌کدام فعال نیست → `stock = 0`؛ fallback فقط برای «بدون هیچ واریانتی»؛ تست حالت «همه غیرفعال» | probe: دو واریانت غیرفعال → stock نمایشی 0؛ صفحهٔ محصول حالت ناموجود نشان دهد |

---

# 🧹 فاز ۳ — بهداشت کد و امنیت پایین‌تر

| # | شدت | تسک | کجا (فایل) | شرح مشکل | راه‌حل |
|---|-----|------|------------|-----------|--------|
| SEC-08 ✅ | 🔵 پایین | گپ مالکیت startPayment برای مهمان | `src/core/commerce/payment-service.ts:50-52` | شرط `if (order.userId && input.userId && …)` وقتی درخواست‌دهنده مهمان است رد می‌شود | شرط را به «اگر سفارش مالک دارد، درخواست‌دهنده باید همان باشد» تغییر بده: `if (order.userId && order.userId !== input.userId) throw FORBIDDEN` |
| SEC-09 ✅ | 🔵 پایین | salt هاردکد OTP در production بی‌هشدار | `src/domain/policies/otp.ts:49` | بدون `OTP_HASH_SALT`، در production هم بی‌صدا `prima-dev-salt` استفاده می‌شود | در production و نبود env → crash fast (هم‌راستا با فلسفهٔ گاردهای mock) یا حداقل warn بلند در بوت |
| SEC-10 ✅ | 🔵 پایین | حذف انگشت‌نگاری و endpoint بی‌مصرف | `next.config.ts` · `src/app/api/route.ts` | هدر `X-Powered-By: Next.js` افشا می‌شود؛ `/api` فقط «Hello world» برمی‌گرداند | `poweredByHeader: false` در next.config؛ حذف route.ts پیش‌فرض (یا پاسخ 404) |
| SEC-11 ✅ | 🔵 پایین | حذف کامل devCode از build production | `src/core/auth/otp-auth-service.ts:114-116` · `src/app/account/actions.ts:49` | کد OTP plaintext در پاسخ فقط با فلگ قفل شده — ریسک پیکربندی اشتباه باقی می‌ماند | در build production مسیر بازگشت devCode کاملاً حذف شود (dead-code elimination با شرط ثابت، نه فقط گارد ران‌تایم) |
| SEC-12 ✅ | 🔵 پایین | چک «تطبیق مبلغ» verify عملاً no-op است | `src/providers/payment/zarinpal.ts:175` · `src/core/commerce/payment-service.ts:156-159` | adapter همان مبلغی که فرستاده را برمی‌گرداند و مقایسه همیشه true می‌شود | در adapter مبلغ را از پاسخ واقعی درگاه بخوان (هرجا برمی‌گرداند)؛ تست با mismatch عمدی → fail |
| SEC-13 ✅ | 🔵 پایین | رشتهٔ اتصال dev هاردکد در کد | `src/lib/db.ts:19-21` | الگوی «secret در کد» در git می‌ماند | fallback حذف و fail-fast با پیام واضح: «DATABASE_URL تنظیم نشده» |
| SEC-14 ✅ | 🔵 پایین | آپلود رسانه: کل فایل قبل از چک حجم در RAM | `src/app/admin/(panel)/media/actions.ts:33-34` · `src/core/media/pipeline.ts:68-70` | سقف ۵MB خط لوله فعلاً دست‌نیافتنی است (سقف action ~۱MB) و پیام خطا مبهم | `experimental.serverActions.bodySizeLimit: "6mb"` + چک `file.size` قبل از `arrayBuffer()` |
| BUG-06 ✅ | 🔵 پایین | تأیید پرداخت با «دست‌کم یک» رزرو فعال | `src/core/commerce/payment-service.ts:161-171` | اگر انقضای رزرو وسط حلقه خطا بخورد، فقط بخشی CONVERT می‌شود → خطر oversell در fulfillment | مقایسهٔ Σqty رزروهای ACTIVE با Σqty اقلام سفارش؛ نابرابری → failPayment با پیام «پنجرهٔ پرداخت منقضی شد» |
| BUG-07 ✅ | 🔵 پایین | خط صفرتایی (ghost) در سبد هنگام stock=0 | `src/store/cart-store.ts:84,102` | `Math.min(x, 0) = 0` → خط با تعداد صفر در سبد می‌ماند و در checkout خطای گیج‌کننده می‌دهد | بعد از clamp اگر `qty < 1` شد خط حذف شود (مثل رفتار updateQuantity) |
| BUG-08 ✅ | 🔵 پایین | سه نسخهٔ موازی فرمول تخفیف کوپن | `src/domain/policies/money.ts:47-68,97-106` · `src/core/commerce/coupon-service.ts:23-33` · `src/core/commerce/checkout-service.ts:234-241` | ریسک واگرایی در پول (خطرناک‌ترین drift)؛ `calcShipping` در money.ts گارد `subtotal=0` ندارد | checkout از `computeDiscount` استفاده کند و کپی inline حذف شود؛ calcShipping هم‌تراز یا حذف به‌عنوان dead code |
| BUG-09 ✅ | 🔵 پایین | catch خام بی‌لاگ در worker انقضای رزرو | `src/core/commerce/inventory-service.ts:181-183` | `catch {}` حتی قطع DB را بی‌صدا می‌بلعد؛ خطاهای سیستمیک نامرئی‌اند | لاگ warn در catch (یا تفکیک خطای رقابتی موردانتظار از بقیه) |
| BUG-10 ✅ | 🔵 پایین | شمارش تلاش OTP غیراتمیک (بورست موازی از سقف ۵ عبور می‌کند) | `src/core/auth/otp-auth-service.ts:172-179` · `src/domain/policies/otp.ts:86` | خواندن attemptCount و بعد increment اتمیک نیست | `updateMany({ where: { id, attemptCount: { lt: 5 } }, data: { attemptCount: { increment: 1 } } })` و تصمیم بر اساس count برگشتی |
| BUG-11 ✅ | 🔵 پایین | `as never` در transitionOrder | `src/core/commerce/order-service.ts:192` | دور زدن تایپ enum | cast امن با تایپ `OrderStatus` + نگاشت صریح |
| BUG-12 ✅ | 🔵 پایین | پاکسازی لاگ‌ها (سه مورد) | `src/app/account/actions.ts:139` · `src/app/checkout/callback/route.ts` · سرچ URL خیلی بلند | (۱) ZodError موردانتظار با stack کامل در لاگ (۲) stack کامل برای DomainError منتظرهٔ callback (۳) URL 100KB → 431 خام Node به‌جای 400 ساختاریافته | (۱) ZodError → `{ok:false,message}` بدون stack (۲) DomainError → لاگ یک‌خطی (۳) هندل 431/URL خیلی بلند → 400 JSON ساختاریافتهٔ خود اپ |
| BUG-13 ✅ | 🔵 پایین | دو اسکیمای ناهمگون کدپستی | `src/domain/schemas/index.ts:67-71` (حساب) vs `src/domain/schemas/commerce.ts:31-34` (چک‌اوت) | «12345-67890» در چک‌اوت قبول و در فرم آدرس رد می‌شود — تجربهٔ ناهمگون | یک نرمال‌ساز مشترک (تبدیل ارقام + حذف فاصله/خط‌تیره) در هر دو |
| BUG-14 ✅ | 🔵 پایین | رد تمیز server action با Origin جعلی — الان 500 خام برمی‌گردد (نویز مانیتورینگ) | گارد Origin فریم‌ورک روی مسیر Server Actions — شواهد 51d-F9: `POST /contact` با `Origin: https://evil.example` → **500** (در حالی که Origin درست + action نامعتبر → 404) | گارد Origin فعال است و بلاک می‌کند، ولی پاسخ 500 خام می‌سازد و alertهای بی‌مورد در مانیتورینگ/لاگ ایجاد می‌کند | گارد Origin در middleware برای مسیرهای POST با پاسخ 403 ساختاریافته برگردانده شود؛ اگر در سطح فریم‌ورک قفل بود، این رده از 500 در مانیتورینگ فیلتر/تفکیک شود | POST با Origin جعلی → 403/400 تمیز؛ این سناریو دیگر 500 ثبت نکند |
| BUG-15 ✅ | ⚪ آینده | اتصال policy مرجوعی (`returns.ts`) هنگام ساخت مسیر مرجوعی مشتری | `src/domain/policies/returns.ts` (هیچ فراخوانی در src ندارد) + UI ادعای «۷ روز مرجوعی» | ریاضیات بازهٔ مرجوعی پیاده و تست شده ولی هیچ مسیری آن را enforce نمی‌کند؛ درخواست مرجوعی مشتری هنوز وجود ندارد → UI بدون پشتوانه است (یافتهٔ 51a §۶) | وقتی فیچر «درخواست مرجوعی مشتری» ساخته شد حتماً همان تابع صدا زده شود؛ تا آن‌موقع تصمیم در کامنت/ADR ثبت بماند | مرجوعی خارج از پنجره در مسیر جدید رد شود (تست integration) |
| BUG-16 ✅ | ⚪ نکته | پاکسازی ریز مستندات + تصمیم ثبت‌نشدهٔ compareAt ناهم‌قیمت | `src/domain/policies/inventory.ts:38` (کامنت) · `src/lib/repositories/mappers.ts` (compareAtPrice از واریانت اول) | (۱) کامنت «TTL کد تخفیف پرداخت روی callback» نادرست/کپی‌پیست است (مقصود: TTL رزرو/پنجرهٔ پرداخت) — 51a پایین ۱۱ (۲) اگر ادمین واریانت‌های یک محصول را ناهم‌قیمت کند، درصد تخفیف کارت بر مبنای compareAt واریانت اول بیش‌نمایی می‌شود — ریسک مستندشدهٔ 51a §۶؛ دیتای فعلی هم‌قیمت است | کامنت اصلاح شود؛ برای واریانت ناهم‌قیمت تصمیم صریح (min/max compareAt یا گارد در فرم ادمین) گرفته و در ADR ثبت شود | کامنت درست؛ تصمیم compareAt در سند/ADR ثبت شده |

---

# 🎨 فاز ۴ — UI/UX به سمت ۱۰/۱۰ (یافته‌های کاربران)

| # | شدت | تسک | کجا | شرح مشکل | راه‌حل | معیار ۱۰/۱۰ |
|---|-----|------|-----|-----------|--------|--------------|
| UX-01 ✅ | 🟡 متوسط | **آمار نظرات صادقانه** — تیتر می‌گوید «نظرات (۱۲۷)» ولی توزیع جمعش ۳۷ و لیست فقط ۳ نظر است؛ میانگین واقعی ۴٫۶ نه ۴٫۸ | `prisma/seed-data/products.ts:51-52` (reviewCount/rating دستی) + نمایش از `src/components/product/` | متادیتای دستی seed با دادهٔ واقعی DB (~۲۰ نظر) ناسازگار است → خدشه به اعتماد خریدار | (الف) reviewCount/rating از DB محاسبه شود (COUNT/AVG واقعی)، یا (ب) seed طوری backfill شود که توزیع نظرات با عدد اعلام‌شده بخواند؛ یکی شود — «UI هرگز چیز جعلی نمی‌سازد» (ADR 011) | تیتر تب = جمع دقیق توزیع = تعداد نظرهای لیست‌شده؛ میانگین = میانگین واقعی |
| UX-02 ✅ | 🟡 متوسط | **فرم آدرس: خطای فیلد-محور فارسی** — کدپستی ۵ رقمی فقط پیام جنریک «ذخیره آدرس ناموفق بود» می‌دهد | `src/app/account/actions.ts:136-147` (ZodError بلعیده می‌شود) + فرم `account-panels.tsx` | پیام فیلد-محور («کد پستی باید ۱۰ رقم باشد») در اسکیما هست ولی به کاربر نمی‌رسد؛ اعتبارسنجی کلاینت هم نیست | استخراج اولین پیام Zod در اکشن و برگرداندن آن؛ اعتبارسنجی کلاینت مثل بقیهٔ فرم‌ها (نشان‌دادن خطا زیر فیلد) | کدپستی غلط → خطای قرمز دقیق زیر همان فیلد؛ فرم آدرس هم‌سطح کیفیت سایر فرم‌ها |
| UX-03 ✅ | 🟡 متوسط | **علاقه‌مندی واقعی (DB)** — الان فقط localStorage است؛ جدول `WishlistItem` هرگز پر نمی‌شود؛ با تعویض دستگاه لیست می‌پرد | `src/store/wishlist-store.ts:20-39` · مدل `WishlistItem` در `prisma/schema.prisma` · بج هدر | دادهٔ کاربر پایدار نیست و بج هدر بعد از خروج هم از localStorage می‌ماند | API/server action برای add/remove/list علاقه‌مندی (فقط مشتری لاگین) + مهاجرت localStorage به سرور در اولین ورود + بج هدر از state سرور؛ برای مهمان هم رفتار شفاف (دعوت به ورود) | افزودن در دستگاه A → در دستگاه B با همان حساب دیده شود؛ جدول WishlistItem پر شود |
| UX-04 ✅ | 🟡 متوسط | **ردیف «تخفیف» گمراه‌کنندهٔ سبد** — بدون هیچ کوپنی «تخفیف −۴۳۵٬۰۰۰» نشان می‌دهد که در مبلغ پرداخت اثر ندارد | `src/lib/cart-logic.ts:24-25` + نمایش در `src/app/cart/cart-view.tsx` | اختلاف compareAt×qty است؛ «جمع کالاها» با قیمت واقعی حساب شده؛ صفحهٔ چک‌اوت این ردیف را ندارد (دو صفحه دو رفتار) | برچسب به «سود شما از قیمت مصوب» تغییر کند یا جمع کالاها بر مبنای compareAt محاسبه شود؛ رفتار سبد و چک‌اوت یکسان شود | جمع ردیف‌ها = مبلغ قابل پرداخت؛ هیچ عددی که با فاکتور نخواند نمایش داده نشود |
| UX-05 ✅ | 🟡 متوسط | **کنتراست دکمهٔ CTA برند (terracotta)** — ۲.۷۵:۱ زیر سقف WCAG حتی برای متن بزرگ | `src/app/globals.css` — متغیر `--color-terracotta` (#c88f72 با متن سفید) | خوانایی کم برای کاربران کم‌بینا؛ hover تیره‌تر هم فقط ۴.۰۷:۱ است | رنگ terracotta برای بستر دکمه تیره‌تر شود (مثلاً #a9714f یا تیره‌تر) تا با متن سفید ≥۴.۵:۱ شود؛ هویت رنگی حفظ شود | چک کنتراست همهٔ دکمه‌ها ≥۴.۵:۱ (متن معمولی) |
| UX-06 ✅ | 🟡 متوسط | **OOM سرور dev هنگام باز کردن /admin/settings** — ۳ بار تأیید شد (RSS تا 2.4GB روی باکس 4GB) | `src/app/admin/(panel)/settings/page.tsx` + settings-forms.tsx (حجیم) | صفحهٔ تنظیمات در dev همهٔ بخش‌ها را یکجا کامپایل/رندر می‌کند؛ QA و دمو را زمین می‌زند | شکستن صفحه به تب‌های سبک‌تر/lazy load بخش‌ها؛ بررسی رندر سنگین فرم‌ها؛ در کوتاه‌مدت: محدودکردن منابع turbopack یا پیش‌کامپایل | باز کردن /admin/settings روی باکس 4GB بدون OOM؛ صفحهٔ تنظیمات QAپذیر شود |
| UX-07 ✅ | 🔵 پایین | toast روی دکمهٔ ارسال می‌نشیند و کلیک فوری را می‌بلعد | تنظیمات sonner/toaster (`src/components/ui/sonner.tsx` یا toaster.tsx) | بعد از هر خطا، ~۳ ثانیه کلیک روی دکمه بی‌اثر است (OTP، پرداخت) | جایگاه toast به بالا-چپ (یا offset کافی از دکمه‌ها) تغییر کند؛ pointer-events فقط روی خود toast | بعد از خطای OTP، کلیک دوم بلافاصله ثبت شود |
| UX-08 ✅ | 🔵 پایین | فیلد OTP با paste/fill درست پر نمی‌شود (تایپ OK) | کامپوننت input-otp در فرم ورود (`src/app/account/login-forms.tsx`) | کاربر معمولاً کد را کپی/پیست می‌کند؛ مقداردهی برنامه‌ای گاهی نادیده گرفته می‌شود | رفتار onChange/paste کامپوننت input-otp اصلاح و با سناریوی paste دستی تست شود | paste کد ۶ رقمی → پر شدن و سابمیت خودکار (در صورت فعال بودن) |
| UX-09 ✅ | 🔵 پایین | «نام ثبت نشده» در پروفایل — راهی برای ثبت نام حساب نیست | `src/app/account/account-panels.tsx` + اکشن پروفایل | نام فقط در دفترچهٔ آدرس ذخیره می‌شود؛ فاکتور/خوش‌آمد بی‌نام است | فیلد ویرایش نام در پنل حساب + ذخیره در مدل User | کاربر بتواند نام ثبت/ویرایش کند و در هدر/پروفایل نمایش داده شود |
| UX-10 ✅ | 🔵 پایین | خالی‌شدن سبد بعد از پرداخت فقط سمت کلاینت است | `src/app/checkout/success/clear-cart.tsx` | باز کردن success در دستگاه/تب دیگر → آیتم‌ها هنوز در سبد دیده می‌شوند (خطر مالی ندارد، گیج‌کننده است) | بعد از پرداخت موفق، سبد سرورمحور خالی شود (اگر خط سبد DB-بک شد با UX-03 هم‌راستا) یا revalidate مسیر cart | در دستگاه دوم بعد از پرداخت، سبد خالی است |
| UX-11 ✅ | 🔵 پایین | favicon 404 (دو ایجنت گزارش دادند) | `src/app/` (app/favicon.ico یا metadata.icons) · `public/logo.svg` موجود | تب مرورگر آیکون پیش‌فرض خاکستری می‌گیرد و هر بار 404 در شبکه ثبت می‌شود | آیکون از روی logo.svg بساز (favicon.ico + apple-touch-icon + link در metadata) | curl -I /favicon.ico → 200؛ تب مرورگر آیکون برند دارد |
| UX-12 ✅ | ⚪ سلیقه‌ای | alt توصیفی برای بندانگشتی‌های گالری | `src/app/product/[slug]/gallery.tsx` | همه `alt=""` دارند — برای سئو و اسکرین‌ریدر ضعیف | alt توصیفی (نام محصول + نمای تصویر) | گالری alt معنادار دارد |
| UX-13 ✅ | 🔵 پایین | پیام انگلیسی خام Zod در فرم تماس | `src/core/commerce/contact-service.ts` (max(2000) بدون پیام فارسی) · `src/lib/validations.ts` (اسکیمای کلاینت اصلاً max ندارد) | پیام >۲۰۰۰ کاراکتری → «Too big: expected string…» انگلیسی به کاربر می‌رسد | پیام فارسی برای max در اسکیمای سرور + اضافه‌کردن max به اسکیمای کلاینت با پیام فارسی + شمارندهٔ کاراکتر در UI | پیام طولانی → خطای فارسی تمیز «پیام حداکثر ۲۰۰۰ نویسه است» |
| UX-14 ✅ | 🔵 پایین | اکسپورت تکراری getCustomerStateAction | `src/app/account/actions.ts:112` · `src/app/cart/actions.ts:73` | دو امضای یکسان در دو فایل — کپی موازی | یکی حذف و از دیگری import شود | grep فقط یک تعریف داشته باشد |

---

# 🔍 فاز ۵ — سئو و اکسسوریلیتی

| # | شدت | تسک | کجا | شرح مشکل | راه‌حل |
|---|-----|------|-----|-----------|--------|
| SEO-01 ✅ | 🔵 پایین | اسکیمای FAQPage + SSR پاسخ‌ها | `src/app/faq/page.tsx` | پاسخ‌ها کلاینت‌رندرند (خزنده نمی‌بیند) و FAQPage JSON-LD وجود ندارد (فقط ۲ بلاک ld+json دیگر) | SSR پاسخ‌ها (یا حداقل در HTML اولیه) + بلاک JSON-LD نوع `FAQPage` با همان ۷ سوال |
| SEO-02 ✅ | 🔵 پایین | مقالات ژورنال فقط پاراگراف‌اند | `prisma/seed-data/content.ts` + رندر `src/app/journal/[slug]/page.tsx` | بدون تیتر بخش (h2/h3) و تصویر درون‌متنی — ضعف سئوی محتوایی | مدل محتوا h2/h3 و تصویر بین‌متنی پشتیبانی کند (اکنون به پاراگراف split می‌شود)؛ seed مقالات موجود غنی‌تر شود |
| SEO-03 ✅ | ⚪ سلیقه‌ای | عنوان CTA یکتا برای هر مقاله + preload فونت | `prisma/seed-data/content.ts` · `src/app/layout.tsx` | هر ۵ مقاله CTA «راهنمای خرید حوله» دارند؛ Vazirmatn preload ندارد | عنوان CTA اختصاصی per مقاله؛ `<link rel="preload" as="font">` برای وزن‌های اصلی Vazirmatn |
| SEO-04 ✅ | 🔵 پایین | حذف هشدار dev مربوط به scroll-behavior | `src/app/globals.css` (روی html) | هشدار Next: «Detected scroll-behavior: smooth on <html>» — لاگ کنسول را شلوغ می‌کند | پیشنهاد Next را اعمال کن (`data-scroll-behavior="smooth"` روی html و حرکت smooth به media/screen مناسب) یا smooth را فقط روی عناصر داخلی بگذار |

---

# 🏗️ فاز ۶ — زیرساخت و M6 (قبل از go-live واقعی)

| # | شدت | تسک | کجا | شرح | راه‌حل |
|---|-----|------|-----|------|--------|
| INFRA-01 | 🟠 بالا (برای M6) | ارتقای sharp (۲ حملهٔ high در libvips/libheif) | `package.json` — sharp 0.34.5 | sharp در پایپ‌لاین آپلود کاربر-مواجه است؛ قبل از فعال‌کردن آپلود عمومی باید ارتقا یابد | ارتقا به 0.35.x + رگرسیون پایپ‌لاین رسانه (آپلود jpeg/png/webp) |
| INFRA-02 | 🔵 پایین | به‌روزرسانی زنجیرهٔ dev | `bun update` | ۴۲ اعلان audit (۰ critical) — اکثراً ابزار dev (eslint/mdxeditor/recharts›lodash) | bun update + بازبینی لاگ و اجرای کامل تست‌ها |
| INFRA-03 | 🟡 متوسط | CSP از Report-Only به enforce با nonce | `next.config.ts:21-34` | CSP فعلی هیچ‌چیز را بلاک نمی‌کند؛ unsafe-inline/eval سقف ارزش CSP را می‌زند | طبق نقشهٔ مرحله‌ای §۹.۲ سند: nonce برای script، حذف unsafe-eval، محدودکردن `img-src https:`؛ XFO به‌عنوان لایهٔ دوم بماند |
| INFRA-04 | 🟠 بالا (قبل از زرین‌پال live) | refund زرین‌پال بدون transactionId | `src/providers/payment/zarinpal.ts:182-204` | بعد از go-live، refund مسیر race و دستی کار نمی‌کند (providerRef ساختگی `zp-${Date.now()}`) | ارسال authority/transactionId مطابق API refund زرین‌پال + تست sandbox + تا آن‌موقع مسیر refund واقعی با گارد «فقط درگاه mock» قفل شود |
| INFRA-05 | ⚪ نکته | هم‌ترازی bun-types با ران‌تایم | `package.json` — bun-types 1.4.2 vs bun 1.3.14 | فقط dev-only | pin به 1.3.x یا ارتقای ران‌تایم |
| INFRA-06 | 🟠 بالا (در دیپلوی) | حذف wildcard سندباکس از allowedOrigins | `next.config.ts:51-55` — `"*.space-z.ai"` | اگر روزی زیردامنه‌ای از space-z.ai در کنترل مهاجم باشد، Origin جعلی برای actionها پذیرفته می‌شود | در دیپلوی واقعی فقط دامنهٔ خود پروژه |
| INFRA-07 | 🟡 متوسط (multi-instance) | rate-limit درون‌حافظه‌ای → Redis | `src/core/rate-limit/in-memory.ts` | با بیش از یک instance سقف‌ها per-process می‌شوند (باقی‌ماندهٔ عمدی مستند M6) | adapter Redis (یا معادل) پشت همان اینترفیس؛ برای تک‌instance فعلی اولویت پایین |
| INFRA-08 | ⚪ نکته | سه ریزهٔ ادمین/پرداخت | `src/core/auth/totp.ts:104-117` · `src/app/admin/(panel)/staff/actions.ts:132` · `src/core/commerce/payment-service.ts:19-30` | (۱) TOTP: مقایسهٔ زمان‌ثابت + فیوز هنگام فعال‌سازی (۲) مجوز اختصاصی برای changeOwnPassword به‌جای settingsRead (۳) callback URL اولویت از NEXT_PUBLIC_SITE_URL به‌جای x-forwarded-host | هر کدام یک تغییر کوچک؛ همراه با M6 انجام شود |
| INFRA-09 | 🟠 بالا (قبل از زرین‌پال live) | کوکی اثبات پرداخت = hash بی‌کلید از authority (CR-6/55-c) — هرکس authority را بداند کوکی را می‌سازد | `src/core/commerce/checkout-service.ts:342-344` | authority در URL/لاگ/تاریخچه ظاهر می‌شود؛ «اثبات» از نظر رمزنگاری مستقل از فاش‌شدن authority نیست (TTL=900s و ۹۶بیت رندوم ریسک فعلی را محدود می‌کند) | `HMAC-SHA256(SERVER_SECRET, authority)` یا nonce تصادفی روی ردیف Payment با مقایسهٔ زمان‌ثابت | قبل از اتصال درگاه واقعی (M5) اعمال و تست شود |

---

# 🗓️ ترتیب اجرای پیشنهادی

```
دوش ۱ (امنیت حیاتی):     SEC-01 → SEC-02 → SEC-03 → SEC-04 → SEC-05 → SEC-06 → SEC-07
دوش ۲ (پول و دیتا):      BUG-01 → BUG-02 → BUG-03 → BUG-04 → BUG-05
دوش ۳ (برد سریع UX):     UX-11 (favicon) → UX-13 → UX-04 → UX-01 → UX-02 → UX-05 → UX-07
دوش ۴ (UX سنگین‌تر):     UX-03 (wishlist DB) → UX-06 (OOM settings) → UX-08 → UX-09 → UX-10
دوش ۵ (بهداشت کد):       فاز ۳ باقی‌مانده (SEC-08…SEC-14، BUG-06…BUG-16، UX-12، UX-14)
دوش ۶ (سئو + M6):        فاز ۵ + INFRA-01/03/04/06 + بقیهٔ INFRA
```

# 🏁 معیار پذیرش نهایی (رسیدن به ۱۰/۱۰)

1. ✅ هر ۷ سناریوی حملهٔ موفق قبلی → تکرار و **شکست** (XFF bypass، IDOR سفارش، دور زدن سقف‌ها)
2. ✅ همهٔ صفحات ادمین با نقش‌های مختلف → ماتریس read رعایت شود (تست integration سبز)
3. ✅ unit + integration: ۱۵۶/۱۵۶ و ۴۱/۴۱ + تست‌های جدید (کوپن موازی، state-machine بازیگر، موجودی غیرفعال، read-matrix)
4. ✅ lint + typecheck صفر
5. ✅ تکرار گشت ۳ کاربر → هیچ یافتهٔ متوسط/بالایی باقی نمانده باشد و امتیاز UX ≥ ۹.۵
6. ✅ گزارش‌های جدید در `qa-reports/` + ثبت رگرسیون در worklog.md
