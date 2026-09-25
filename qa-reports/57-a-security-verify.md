# گزارش تأیید امنیت مستقل — Task 57-a (Security Verifier)

- **نقش:** تأییدگر امنیت شکاک — اثبات زندهٔ روی سرور که هر ۷ فیکس اصلی فاز ۱ سر جایشان است، فیکس‌های ۸گانهٔ Task 56 کار می‌کنند و رگرسیونی رخ نداده
- **سرور:** http://localhost:3000 (dev، Turbopack، next-server v16.3.6 — اینstance 22:37) · **تاریخ:** 2026-09-25، ~۲۲:۳۵–۲۳:۰۰ UTC
- **روش:** صفر تغییر در کد/`.env`/git/DB-structure · بدون `next build` · بدون kill سرور · curl + اسکریپت‌های Bun فقط‌خواندنی + mint نشست در DB (الگوی tmp-55a) · شواهد خام: `towel-parima/qa-reports/tmp-57a/`
- **ادمین واقعی دست‌نخورده:** هرگز با `admin@prima-store.ir` تلاش ورود نشد؛ تنها ایمیل آزمایشی `lock57a@example.invalid` (۶ فراخوانی) و کاربران mint‌شدهٔ `sec01-57a+*@prima.test` استفاده شد.

---

## ۱) خلاصهٔ اجرایی — جدول رأی فیکس‌های ۸گانهٔ Task 56

| فیکس | شرح | رأی | مدرک کلیدی زنده |
|---|---|---|---|
| **F55-1** (CR-1) | گیت `analyticsRead` داشبورد | ✅ **FIXED-CONFIRMED** | SUPPORT_AGENT → `/admin` = **307 → /admin/no-access** با **صفر** KPI؛ SUPER_ADMIN = 200 با KPIها («ارزش تقریبی انبار: ۲۳۴٬۱۸۰٬۰۰۰ تومان»، «پرفروش‌های خودکار»)؛ STORE_MANAGER (دارای analyticsRead در roles.ts) = 200 |
| **F55-2/3/4** (CR-2/3/4) | بازنویسی client-ip (net.isIP + BigInt + رد /0) | ✅ **FIXED-CONFIRMED** (کد + رگرسیون fail-closed زنده) | ۵ ترفند هدری XFF/X-Real-IP/True-Client-IP روی bucket پرِ health → **همه 429** (bucket اشتراکی unknown — هیچ bucket تازه‌ای از هدر جعل نشد)؛ کد جدید `src/lib/client-ip.ts` با `net.isIP`/BigInt/رد `/0` بازبینی شد (پوشش IPv6 زنده نیازمند TRUSTED_PROXY_CIDR است که بدون تغییر env ممکن نبود — همان محدودیت 55-a؛ ۵ تست IPv6 در unit پوشش می‌دهد) |
| **F55-5** (CR-5) | خواندن bounded 4KB با cancel در سرریز (csp-report) | ✅ **FIXED-CONFIRMED** | (الف) ۱۱۰KB با CL → 204 **بدون هیچ رکوردی**؛ (ج) chunked ~100KB → 204 در **۷ms بدون هیچ رکوردی**؛ (د۱) chunked دقیقاً 4096B → رکورد `csp_violation_oversized` با **`size:4096`** (نه 102507) — مدرک مستقیم سقف؛ (د۲) chunked 4097B → هیچ (نکتهٔ انطباق انتظار مأموریت: بخش ۳-پ) |
| **F55-6** (CR-7) | هدر Retry-After در 429ها | ✅ **FIXED-CONFIRMED** | health #121 = 429 با **`retry-after: 57`** و بدنهٔ `{"status":"rate_limited"}`؛ search #31 = 429 با **`retry-after: 59`** و `{"items":[]}`؛ هر دو عدد صحیح 1..60 |
| **F55-7** (CR-8/CR-10) | یکدست‌سازی sms/notifications با requirePageAccess + scope=per-ip در audit | ✅ **FIXED-CONFIRMED** | sms (ordersRead): هر ۳ نقش مأموریت = 200؛ **CONTENT_MANAGER بدون ordersRead → 307 به `/admin/no-access`** (نه به `/admin` — رفع ناسازگاری CR-8)؛ notifications = 200 برای همهٔ نقش‌های دارای یکی از ۳ مجوز؛ ردیف audit زندهٔ 429 ورود ادمین با **`after.scope=per-ip`** ثبت شد |
| **F55-8** | تست مستقیم SEC-05/06/07 | ✅ **CONFIRMED (غیرمستقیم)** | رکوردهای اجرای suite روی سرور در dev.log (L125/L128 با document-uri و size=4090 — متعلق به اجرای موازی تست، نه من)؛ پوشش unit/integration قبلاً در 55-d/56 اعتبارسنجی شد |
| رگرسیون SEC-01..07 | — | ✅ **هیچ رگرسیونی** | ماتریس ۱۵+۶ مسیر × ۳+۱ نقش دقیقاً مطابق نقشه؛ SEC-02 fail-closed؛ SEC-03 گیت‌ها؛ SEC-06 سقف دقیق 120/30؛ SEC-07 کوکی اثبات — همه بازتأیید (بخش‌های ۲–۶) |

**یافتهٔ جدید این بازبینی: ۰ باگ امنیتی.** ۱ نکتهٔ انطباق مشاهده‌گری (بخش ۳-پ) + ۱ مشاهدهٔ UI-محیطی (بخش ۷). هیچ‌کدام ردّ فیکس نیست.

---

## ۲) SEC-01 + F55-1 + F55-7 — ماتریس نقش×مسیر (اجرا زنده با کوکی mint‌شده)

**نقشهٔ مرجع:** `ADMIN_PAGE_READ_MAP` اکنون **۱۵ مسیر** دارد (dashboard، staff، audit، settings، orders، messages، products، reviews، journal، media، faq، categories، collections، **sms**، **notifications**) — `src/lib/admin/page-read-map.ts:23-54`.

### ماتریس ۱۵ مسیر اصلی (کد HTTP ← مقصد redirect)

| مسیر (مجوز لازم) | SUPER_ADMIN | SUPPORT_AGENT | STORE_MANAGER |
|---|---|---|---|
| /admin (dashboard: analyticsRead) | 200 | **307 → no-access** ✅F55-1 | 200 ✅ |
| /admin/staff (usersRead) | 200 | **307 → no-access** | **307 → no-access** |
| /admin/audit (auditRead) | 200 | **307 → no-access** | **307 → no-access** |
| /admin/settings (settingsRead) | 200 | **307 → no-access** | 200 |
| /admin/orders (ordersRead) | 200 | 200 | 200 |
| /admin/messages (customersRead) | 200 | 200 | 200 |
| /admin/products (productsRead) | 200 | 200 | 200 |
| /admin/reviews (reviewsRead) | 200 | 200 | 200 |
| /admin/journal (contentRead) | 200 | **307 → no-access** | 200 |
| /admin/media (mediaRead) | 200 | **307 → no-access** | 200 |
| /admin/faq (contentRead) | 200 | **307 → no-access** | 200 |
| /admin/categories (productsRead) | 200 | 200 | 200 |
| /admin/collections (productsRead) | 200 | 200 | 200 |
| **/admin/sms (ordersRead)** ✅F55-7 | 200 | 200 | 200 |
| **/admin/notifications (analytics|products|reviews)** ✅F55-7 | 200 | 200 | 200 |

- STORE_MANAGER در `roles.ts` **دارای analyticsRead** است → داشبورد 200 صحیح است (تنها تفاوت با SUPER_ADMIN: نبود usersRead/auditRead — دقیقاً همان تنها تفاوت نتیجه).
- **تأیید تکمیلی F55-7 با نقش چهارم CONTENT_MANAGER (بدون ordersRead، دارای productsRead/analyticsRead):** `/admin/sms` = **307 → /admin/no-access** · `/admin/notifications` = 200 · `/admin` = 200 · `/admin/journal` = 200 — مقصد redirect پیامک اکنون کانونی است (قبلاً به `/admin` پرش می‌کرد).

### زیرصفحه‌ها با شناسهٔ واقعی DB (سفارش `cmuhc8rwg0011lt6iucwnaj4h`، ژورنال `cmuh89ry0005llt0u2bljkf8e`، محصول `p1`)

| مسیر | SUPER_ADMIN | SUPPORT_AGENT | STORE_MANAGER |
|---|---|---|---|
| /admin/orders/{id} (صفحه‌ای وجود ندارد) | 404 | 404 | 404 |
| /admin/orders/{id}/invoice (orders) | 200 | 200 | 200 |
| /admin/products/new (products) | 200 | 200 | 200 |
| /admin/products/p1/edit (products) | 200 | 200 | 200 |
| /admin/journal/new (content) | 200 | **307 → no-access** | 200 |
| /admin/journal/{id} (content) | 200 | **307 → no-access** | 200 |
| /admin/no-access | 200 | 200 | 200 |

**صفر مثبت کاذب (غیرمجازِ 200) و صفر منفی کاذب (مجازِ 3xx) در کل ۶۰ سلول + ۶ سلول تکمیلی.**

### کنترل بدون‌نشست (کوکی حذف‌شده)
`/admin`، `/admin/staff`، `/admin/orders`، `/admin/products`، `/admin/sms`، `/admin/notifications` → همگی **307 → `/admin/login?next=%2F…`** ✅

### صفحهٔ no-access و KPI
- SUPPORT_AGENT → `/admin` (raw 307): بدنهٔ استریم‌شدهٔ **فاقد هر مقدار/عنوان KPI** (شمارش «ارزش تقریبی انبار/پرفروش‌های خودکار/مجموع مبلغ سفارش» = 0؛ فقط متن استاتیک نوار بالای سایت «ارسال رایگان برای سفارش‌های بالای …» که KPI نیست)؛ صفحهٔ دنبال‌شده = no-access (200، بدون حلقهٔ redirect، حاوی «دسترسی به این بخش ندارید»).
- SUPER_ADMIN → `/admin` (200): KPIها حاضرند — «ارزش تقریبی انبار: ۲۳۴٬۱۸۰٬۰۰۰ تومان»، «سفارش‌ها»، «پرفروش‌های خودکار».
- **لینک شرطی داشبورد در no-access دقیقاً مطابق کد است:** SUPPORT_AGENT بدون analyticsRead → دکمهٔ «بازگشت به داشبورد» **رندر نمی‌شود** (0 occurrences)؛ SUPER_ADMIN → 1 occurrence. (مشاهدهٔ جانبی: در **layout سایدبار پنل** لینک لوگو/آیتم داشبورد `href="/admin"` برای همهٔ نقش‌ها هست — فقط chrome ناوبری است؛ سرورِ صفحه همچنان 307 می‌دهد؛ یافتهٔ امنیتی نیست.)
- شواهد: `tmp-57a/dash-super.html`، `dash-support-raw.html`، `dash-support-followed.html`، `noaccess-support.html`، `noaccess-super.html`.

---

## ۳) SEC-05 + F55-5 — چهار سناریوی /api/csp-report

پایهٔ تازه مستقیماً پیش از تست: dev.log خط ۲۱۱، رکورد csp = ۳ (هر ۳ متعلق به اجرای موازی suite — بخش ۷). پس از تست: رکورد = ۵؛ **هر ۲ رکورد جدید از آنِ من است.**

| سناریو | ارسال | کد HTTP | رکورد جدید در dev.log |
|---|---|---|---|
| (الف) ~۱۱۰KB **با** Content-Length | 112,742B | **204** | **هیچ** — گیت CL قبل از خواندن ✅ |
| (ب) سالم کوچک | 178B | **204** | **+۱** `csp_violation` کامل با مارکر `QA57A-SMALL` — **خط ۲۱۳** ✅ |
| (ج) chunked بدون CL ~100KB | 102,528B | **204 در ۷ms** | **هیچ** — stream در سقف cancel شد، نه خواندن کامل و نه لاگ ✅ |
| (د۱) chunked دقیقاً **4096B** | 4,096B (+overhead فریم) | **204** | **+۱** `csp_violation_oversized` با **`"size":4096`** — **خط ۲۱۶** ✅ |
| (د۲) chunked دقیقاً **4097B** | 4,097B | **204** | **هیچ** — `total > cap` → cancel ✅ |

**تفسیر مرز (د):** بدنهٔ 4096بایتی کامل خوانده و parse شد (payload > 2KB → فقط متادیتا با size دقیقاً 4096)؛ **یک بایت بیشتر (4097) → cancel بی‌لاگ.** این جفت، مدرک مستقیم bounded-read با سقف واقعی 4KB است؛ رکورد بزرگِ chunked هرگز کامل در RAM بافر نمی‌شود (نه 100000-size رکوردی، نه تأخیر — ۷ms برای 100KB).

### پ) نکتهٔ انطباق مشاهده‌گری (یافتهٔ جدید نیست)
انتظار متن مأموریت برای (ج) «+۱ رکورد csp_violation_oversized با size حدود سقف» بود؛ **پیاده‌سازی F55-5 عمداً در سرریز cancel و کاملاً بی‌لاگ است** (کامنت کد: «بدون لاگ (ضد log flooding)»). رکوردِ `oversized` فقط برای بدنه‌هایی صادر می‌شود که کامل (≤4KB) خوانده شده ولی payload لاگشان >2KB است — دقیقاً همان چیزی که (د۱) اثبات کرد. یعنی خواص امنیتی موردنظر (بدون flooding، بدون بافر RAM، سقف 4KB) **همگی اثبات شدند**؛ صرفاً مشاهدپذیرِ مسیر chunked-سربارگذاری «سکوت» است نه «رکورد متادیتا». رأی فیکس تغییر نمی‌کند.

---

## ۴) SEC-06 + F55-6 — سقف‌ها و Retry-After

| تست | نتیجه |
|---|---|
| ۱۲۱ درخواست پشت‌سرهم `/api/health` | **1-120 = 200** و **#121 = 429** با هدر **`retry-after: 57`** (صحیح 1..60) و بدنهٔ generic **`{"status":"rate_limited"}`** (خام: `health-121-headers.txt` / `health-121-body.json` / `health-statuses.txt`) |
| جداسازی bucket: بلافاصله پس از 429 سلامت، `/api/media/file/uploads/2026/09/01a0da88-….orig.jpg` | **200** (3,119B) — bucket `media-file:unknown` از `health:unknown` جداست ✅ |
| `/api/search?q=حوله` × ۳۱ (کوئری URL-encoded) | **1-30 = 200** و **#31 = 429** با **`retry-after: 59`** و بدنهٔ `{"items":[]}` (خام: `search-statuses2.txt` / `search-final-headers.txt`) |
| خروج از پنجره | ~۶۰s بعد health دوباره 200 (bucket پاک شد) |

نکتهٔ اجرا: بورست اولِ search با کوئری UTF-8 خام (بدون encode) به‌جای 429 با **400 در لایهٔ HTTP** رد شد (رفتار Next/Turbopack با request-target غیر ASCII؛ خارج از اپ) و bucket را مصرف نکرد؛ بورست رسمی با encode تمیز تکرار شد. یافتهٔ امنیتی نیست — برای بازتولید: `-G --data-urlencode`.

---

## ۵) SEC-07 — سفارش مهمان واقعی + گارد درگاه mock

- **placeOrderAction** (action-id `405210e84aeca7761b4dfd6d53bf2fd1fe3509f4bf` از چانک کلاینت `/checkout`) با `lineId="p1__white__bath-large"` (واریانت فعال: stock=4, reserved=0, price=745,000) و آدرس معتبر →
  `{"ok":true,"redirectUrl":"/mock-gateway?authority=MOCK-e037eedbf8b9a26def5d4a0b","orderCode":"8687459998"}`
- **Set-Cookie:** `prima_pay_proof=c144bebc1e5b80a3782091420e09ee0c3a8baf8aa87191dbb76622469e665ebc; Path=/; Max-Age=900; HttpOnly; SameSite=lax` — مقدار = دقیقاً `sha256("MOCK-e037eedbf8b9a26def5d4a0b")` (محاسبهٔ مستقل sha256sum) ✅ هر ۴ فلگ ✅
- `GET /mock-gateway?authority=…`:
  1. **بدون کوکی** → «تراکنش یافت نشد» (1)، بدون amount (0) و بدون کد سفارش (0) ✅
  2. **کوکی درست** → `class="amount">۸۳۴٬۰۰۰ تومان` + `کد سفارش: 8687459998`؛ پیام «یافت نشد» غایب ✅ (مبلغ سرورمحور = grandTotal 834,000 شامل ارسال)
  3. **کوکی جعلی** (`sha256("not-the-authority-57a")` = `3970e08a…`، طول برابر ۶۴) → «تراکنش یافت نشد»، بدون مبلغ/کد ✅
- شواهد: `sec07-place-headers.txt`، `gw-{nocookie,goodcookie,fakecookie}.html`.

---

## ۶) رگرسیون سبک

**الف) ۵ ترفند هدری روی bucket پرِ health (پس از 120 درخواست refill):** همه **429** —
`X-Forwarded-For: 1.2.3.4` · `X-Forwarded-For: 1.2.3.4, 5.6.7.8` · `X-Real-IP: 9.9.9.9` · `X-Forwarded-For: 10.0.0.1` · `True-Client-IP: 7.7.7.7` → fail-closed SEC-02/F55-2/3/4 پابرجاست (`xff-tricks.txt`).

**ب) ۵ واریانت URL روی `/admin/staff` با نشست SUPPORT_AGENT (بدون usersRead):** هیچ‌کدام 200 نشد —
`/admin/staff/` → **308** به کانونی · `//admin/staff` → **308** · `/./admin/staff` → **307 → no-access** · `/admin%2Fstaff` → **404** · `/ADMIN/STAFF` → **404** (`url-variants.txt`).

---

## ۷) حوادث و تداخل‌های محیطی (جداشده از باگ‌ها)

- **OOM در جلسهٔ من رخ نداد.** تنها رکورد OOM در dmesg به زمان تقریبی **21:27:26 UTC** برمی‌گردد (map از boot 16:52) — متعلق به جلسهٔ Task 55، پیش از شروع من. اینstance فعلی next-server از 22:37 فعال است و کل شواهد من روی همین instance و با bucketهای سرد گرفته شد.
- **فعالیت موازی روی سرور:** حین جلسهٔ من اجرای suite integration (sec-hardening) و ردیف‌های mint دیگری (`role_qa57b_min`، `NO_ACCESS`) روی همین server/DB دیده شد (رکوردهای csp با `document-uri: prima.example` در dev.log L125/L128 و چند `GET /api/health 429` پس از بورست من). هیچ‌کدام روی شواهد من اثر نگذاشت (پایه‌ها بلافاصله پیش از هر تست گرفته شد؛ بورست health من دقیقاً 120×200+429#121 بود که فقط با bucket سرد سازگار است).
- یک خطای mint خودم (`mint-cm.ts` با roleId هاردکد → FK violation) رخ داد که با استفاده از id واقعی نقش seed‌شده اصلاح شد؛ اثری روی داده نگذاشت.

## ۸) bucketهای گرم‌رهاشده

| bucket | وضعیت پایان جلسه | انقضا |
|---|---|---|
| `admin-signin-email:lock57a@example.invalid` | 6/10 | ≤ ۱ ساعت (خودش خالی می‌شود) |
| `admin-signin:unknown:lock57a@example.invalid` | 5/5 | ≤ ۱۵ دقیقه |
| `health:unknown` / `search:unknown` | تخلیه‌شده (200 انتهای جلسه) | — |
| `csp-report:unknown` | 5 hit در پنجرهٔ ۱دقیقه‌ای | منقضی |

## ۹) پاکسازی + راستی‌آزمایی (`tmp-57a/cleanup-result.json` / `verify-clean-result.json`)

```json
{"order":"8687459998","outboxEvents":1,"sms":1,"payments":1,"orderItems":1,
 "reservations":1,"reservedRecomputedVariants":1,"auditDeleted":6,
 "mintedSessions":1,"mintedUsers":3}
```
راستی‌آزمایی نهایی: **orderLeft=0 · paymentLeft=0 · variantsWithReservedNotZero=0 · activeReservationsLeft=0 · mintedUsersLeft=0 · mintedSessionsLeft=0 · auditLeft=0 · realAdminIntact=true** (+ پاکسازی نشست چهارم CONTENT_MANAGER: 1 session/1 user). هیچ ردیف seed/سفارش واقعی دست نخورد؛ هیچ تغییر env/کد/ساختار DB انجام نشد.

## ۱۰) فایل‌های شواهد (`qa-reports/tmp-57a/`)

`mint.ts`/`mint-output.txt`/`mint-cm.ts`/`mint-cm-output.txt` · `db-facts*.ts` · `matrix-main.sh`/`matrix-main.txt` · `matrix-sub.sh`/`matrix-sub.txt` · `dash-*.html`/`noaccess-*.html` · `login-page.html`/`login-action-chunk.js`/`sec03-{baseline,audit,audit-sample}.json`/`sec03-try{1..6}-{headers,body}.txt` · `gen-bodies.ts`/`csp-*.json`/`csp-baseline.txt`/`csp-after.txt` · `health-statuses.txt`/`health-121-{headers,body}.*`/`media-isolation.txt`/`search-statuses2.txt`/`search-final-{headers,body}.*` · `sec07-place-{headers,body}.*`/`gw-*.html` · `xff-tricks.txt`/`url-variants.txt`/`cm-tests.txt` · `cleanup.ts`/`cleanup-result.json`/`verify-clean.ts`/`verify-clean-result.json` — رکوردهای CSP من: `towel-parima/dev.log` خطوط **۲۱۳** و **۲۱۶**.
