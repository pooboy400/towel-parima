# گزارش 57-d — مهندس تست: baseline کامل پس از فیکس (Task 56) — اجرای مستقل، ارزش محافظتی، بهداشت DB

- تاریخ: 2026-09-26 · اجراکننده: Test Engineer (Task 57-d)
- مخزن: `/home/z/my-project/towel-parima` · **هیچ کد/env/test تغییر نکرد** (تنها فایل ساختگی من: `qa-reports/tmp-57d/db-look.ts` — تایپ‌کلین و لینت‌کلین)
- لاگ‌های خام: `qa-reports/tmp-57d/` (typecheck.log، typecheck-final.log، lint.log، unit-1.log، integration-1.log، integration-2.log، db-look.ts + db-look.out.json، health.json)
- مرجع مقایسه: `55-d-testsuite.md` (دور قبل خودم)

---

## ۱) جدول نتایج اجرا

| چک | فرمان | EXIT | شمارش دقیق | زمان |
|---|---|---|---|---|
| typecheck | `bun run typecheck` | ⚠️ **2** | **۳ خطا — هر سه در اسکریپت‌های ساختگی `qa-reports/tmp-56\|57a\|57b`؛ در `src/` و `tests/` = 0 خطا** | 3.4s |
| lint | `bun run lint` | ✅ 0 | 0 خطا / **۹ هشدار — همه در `.js`های شواهد `tmp-57a`**؛ src/tests = 0 | 11.8s |
| unit | `bun test tests/unit` | ✅ 0 | **172 pass / 0 fail / 0 skip** (15 فایل، 530 expect) | 226ms |
| integration دور ۱ | `bun test tests/integration` | ✅ 0 | **56 pass / 0 fail / 0 skip** (7 فایل، 530 expect) | 1.64s |
| integration دور ۲ (flaky-check) | همان فرمان | ✅ 0 | 56/0/0 — **دقیقاً همسان دور ۱** (نام‌ها، ترتیب، تعداد) | 1.82s |

### ریشه‌یابی انحراف typecheck (EXIT=2)

- هر ۳ خطا مال فایل‌های اسکرچِ زبالهٔ ادواریِ ایجنت‌های قبلی‌اند (نه کد محصول):
  1. `qa-reports/tmp-56/cleanup-56.ts(9,34)` — TS18047 (`u.email` possibly null)
  2. `qa-reports/tmp-57a/db-facts.ts(11,107)` — TS18046 (`reservedN` unknown)
  3. `qa-reports/tmp-57b/cleanup-57b.ts(24,59)` — TS2353 (`phone` در `SmsLogWhereInput` نیست)
- علت ساختاری: `tsconfig.json` الگوی `**/*.ts` را include می‌کند و `qa-reports` را exclude نکرده است (فقط node_modules/skills/examples/tests/scripts خارج‌اند).
- ادعای «typecheck ✅» دور 56 از نظر کد محصول (src/tests) **هم‌چنان برقرار است** — صفر خطا خارج از qa-reports. ادعای `bun run typecheck` خام امروز قرمز است؛ این بدهی بهداشتیِ پوشهٔ شواهد است نه رگرسیون کد.
- پیشنهاد (اعمال‌نشده — خارج از صلاحیت من): افزودن `"qa-reports"` به exclude تایپ‌کریک/eslint، یا ذخیرهٔ اسکریپت‌های اسکرچ با پسوند غیرتایپ‌شونده.

### ریشه‌یابی دلتای شمارش تست‌ها (هیچ تستی از دست نرفته)

- unit: 167 → **172** = دقیقاً **+۵ تستِ تازه** در describe جدید «سخت‌سازی CR-2/CR-3/CR-4» فایل `tests/unit/client-ip.test.ts` (۱۱ قبلی + ۵ جدید = 16 — مطابق انتظار).
- integration: 46 → **56** = دقیقاً **+۱۰ تستِ فایل جدید** `tests/integration/sec-hardening.test.ts` (۳ SEC-05 + ۳ SEC-06/CR-7 + ۴ SEC-07).
- تفکیک فایل‌ها (دور ۱): commerce-core 18 · customer-m4 14 · **sec-hardening 10** · rbac-matrix 5 · media-pipeline 5 · order-tracking 3 · admin-signin-ratelimit 1 = 56 ✓

## ۲) ساختار تست‌های تازه

**`sec-hardening.test.ts` — دقیقاً ۱۰ تست در ۳ describe (فراخوانی مستقیم هندلرها، بدون وابستگی به سرور dev):**

| # | نام تست | چه چیزی را تمرین می‌کند |
|---|---|---|
| 1 | بدنهٔ ~110KB با Content-Length → 204 بدون هیچ لاگ | مسیر سریع CL + ضد log-flooding |
| 2 | بدنهٔ chunked ۱۰۰KB بدون CL → 204 بدون لاگ (خواندن bounded — CR-5) | **F55-5** — ReadableStream واقعی + شنود console.log («نه لاگ کامل و نه متادیتا») |
| 3 | بدنهٔ سالم کوچک → 204 با دقیقاً یک لاگ csp_violation | مسیر سالم + شکل رکورد |
| 4 | health: دقیقاً 120 پاسخ سالم سپس 429 با Retry-After ≥ 1 | سقف دقیق publicApi + **F55-6** |
| 5 | media-file: bucket مستقل، سقف 120 سپس 429 با Retry-After | جداسازی bucket + F55-6 |
| 6 | search: سقف 30/min سپس 429 با Retry-After | سقف search + F55-6 |
| 7 | بدون کوکی → «تراکنش یافت نشد» بدون مبلغ و کد | SEC-07 — نه CODE نه «تومان» در خروجی |
| 8 | کوکی اثبات درست (sha256 authority) → مبلغ + کد | مسیر مثبت با `paidProofValue` واقعی |
| 9 | کوکی جعلی → «تراکنش یافت نشد» | sha256 مقدار غریبه |
| 10 | authority ناموجود → «تراکنش یافت نشد» (بدون نشت تفاوت) | oracle یکسان |

- بهداشت فایل: cleanup در afterAll (فقط payment+order خودش — و بعد از اجرا تأیید کردم ردیفی نمانده)، timeout صریح هر تست، فیکسچر request مینیمال.

**`client-ip.test.ts` = 16 تست** (2 مستقیم + 9 پروکسی + 5 سخت‌سازی جدید: شکل‌های جعلی CR-2، کانونی‌سازی CR-3، prefix کامل IPv6، /0 و اسلش انتهایی و زباله، عضو خراب بین سالم‌ها).

**`rbac-matrix.test.ts`** — ردیف‌های جدید: `dashboard` برای SUPPORT_AGENT=false (L109)، CONTENT_MANAGER=true (L124)، STORE_MANAGER=true (L134)؛ `sms=true` و `notifications=true` برای SUPPORT_AGENT (L110-111)؛ حلقهٔ SUPER_ADMIN اکنون روی هر ۱۵ مسیر نقشه (L138). نقشهٔ `page-read-map.ts` = 15 مسیر شامل `dashboard: [analyticsRead]`، `sms: [ordersRead]`، `notifications: [analytics/products/reviews Read]`.

**CR-9 در `admin-signin-ratelimit.test.ts`** — تأیید (L12-19): کامنت صادقانه که کلید per-email ذاتاً IP ندارد، اثبات ترتیب گیت‌ها/audit به اثبات زندهٔ 55-a ارجاع داده شده و دلیل تست‌نشدن سطح اکشن (وابستگی next/headers) مستند است. ضمناً انتقاد دور 55-d (assert همیشه‌درستِ `toContain("10.77")` روی آرایهٔ تزئینی IP) حذف شده و reset ابتدا/انتها سالم است.

## ۳) ارزش محافظتی — رأی هر فیکس (تحلیل استاتیک + تفکر mutation، بدون اجرا)

| فیکس | جهش فرضی | نتیجهٔ سوئیت | رأی |
|---|---|---|---|
| **F55-1** گارد داشبورد | حذف ردیف `dashboard` از page-read-map | 🔴 قرمز: «read-matrix صفحات ادمین (SEC-01) — هر نقش فقط صفحات مجاز read را می‌بیند» (canAccessAdminPage(content/store,"dashboard") روی مسیر غایب throw می‌کند) | نقشه: محافظت‌شده |
| | حذف `requirePageAccess("dashboard")` از page.tsx | 🟢 سبز می‌ماند — هیچ تستی page.tsx را import/اسکن نمی‌کند (rg: صفر referens در tests) | **سیم‌کشی صفحه: فقط-زنده** (57-a: 307 با 0 KPI؛ 57-b: ۱۷ واریانت URL + `GET /api/admin/dashboard/sales` = 403) |
| **F55-5** bounded-read | بازگشت به `request.json()` | 🔴 قرمز: تست ۲ (chunked ۱۰۰KB) — status همچنان 204 می‌ماند ولی رکورد `csp_violation_oversized` در شنود console ظاهر می‌شود و `expect(...some(...)).toBe(false)` می‌شکند. فقط همین ۱ تست قاتل است (تست ۱ به‌خاطر fast-path CL در هر دو پیاده‌سازی سبز می‌ماند) | محافظت‌شده اما با یک نقطهٔ شکست |
| **F55-6** Retry-After | حذف هدر از هر ۳ روت | 🔴 قرمز: هر ۳ تست SEC-06 (هر کدام `retry-after` را not-null کرده‌اند) | محافظت‌شدهٔ قوی |
| **F55-2/3/4** بازنویسی client-ip | بازگشت پارس عضو به `includes(":")` | 🔴 قرمز: «شکل‌های جعلی IPv6/پورت‌دار/براکت‌دار/نامشخص… (CR-2)» — `garbage::zz`، `1.2.3.4:80`، `[::1]`، `::` دوباره IP حساب می‌شوند | محافظت‌شده |
| | بازگشت مقایسهٔ CIDR به رشته‌ای | 🔴 قرمز: «کانونی‌سازی باینری IPv6 (CR-3)» — `0:0:0:0:0:0:0:1` بیرون از `::1/128` تشخیص داده می‌شد | محافظت‌شده |
| | دور ریختن prefix≠/128 (رفتار قدیمی) | 🔴 قرمز: «prefix کامل IPv6… (CR-3/CR-4)» — `2001:db8::/32` drop می‌شد و عضو معتمد می‌شد | محافظت‌شده |
| | نکتهٔ صادقانه: دو assert «/0» و «اسلش انتهایی» در جهش قدیمی هم سبز می‌مانند (هر دو مسیر خروجی null می‌دهند؛ قدیمی به‌دلیل trust-all، جدید به‌دلیل رد عضو) — اما case «/8/x» قاتل است | نیمه‌حساس | |
| **F55-7** sms/notif + scope | حذف `sms`/`notifications` از map | 🔴 قرمز: همان تست read-matrix (expect(support sms/notifications).toBe(true)) | محافظت‌شده |
| | حذف `after.scope="per-ip"` از گیت audit ورود (actions.ts:84) | 🟢 سبز می‌ماند — هیچ تستی ردیف audit ورود/scope را assert نمی‌کند | **فقط-زنده** (57-a: دقیقاً ۱ ردیف auth.login.rate_limited با scope=per-ip) |

**جمع‌بندی فقط-زنده (بی‌محافظ تستی) در ۸ فیکس:** ① سیم‌کشی `requirePageAccess` داشبورد (و به‌طور کلی هر ۱۷ صفحه — این همیشه زنده‌فقط بوده)، ② فیلد `after.scope=per-ip` در audit ورود. بقیهٔ سطوح F55-1..7 پوشش تستی مستقیم دارند. SEC-03 هم همچنان در سطح اکشن/audit زنده‌فقط است (با کامنت CR-9 مستند).

### نمره‌دهی (معیار 55-d: ارزش mutation، ایزولاسیون، پوشش مرز)

| فایل | نمره جدید | نمره قبل | توضیح |
|---|---|---|---|
| `sec-hardening.test.ts` | **8/10** | — (قبلاً بی‌هیچ تست) | قوت: مرزهای دقیق (120/120/30)، assert هدر Retry-After نه فقط status، chunked واقعی با ReadableStream، شنود console (mutation-sensitive)، ماتریس ۴حالتهٔ کوکی درگاه، cleanup، بدون وابستگی به سرور dev. ضعف: سطح هندلر نه HTTP (لایهٔ 400ِ هدرهای CL خراب — که 57-b زنده دید — بیرون تست است)؛ media/search اولین 429 را می‌گیرند و شمارش دقیق نمی‌کنند؛ مسیر رکورد متادیتا (2KB<payload≤4KB → csp_violation_oversized) بی‌تست؛ مسیر «نشست مالک» و وضعیت PAID درگاه بی‌تست؛ seed داخل تست ۱ (وابستگی ترتیبی ۷→۸→۹)؛ شنود فقط console.log است (سوییچ به warn/error خود را گم می‌کند) |
| `client-ip.test.ts` (بهبودها) | **8/10** | 7/10 | هر ۶ شکافی که 55-d/55-c گزارش کرد (garbage-IPv6، پورت‌دار، براکت، نامشخص، کانونی‌سازی، prefix≠128، /0+اسلش) اکنون تست دارد و جهش‌کش است؛ ایزولاسیون env سرپاست. باقی: /0 و اسلش در سطح خروجی از trust-all قدیمی تمیزدادنی نیستند (null/null)، XFF مخلوط IPv4+IPv6 چندهاپ، zone-id `%`، و x-real-ip با IPv6 پوشیده نیست |
| `admin-signin-ratelimit.test.ts` (بازنویسی) | **7/10** | 5/10 | assert بی‌اثر حذف، کامنت CR-9 صادق، reset دولبه؛ همچنان اکشن/audit را تمرین نمی‌کند (دلیل مستند) |
| `rbac-matrix.test.ts` (ردیف‌های تازه) | **8.5/10** | 8/10 | ۳ مسیر جاافتاده وارد ماتریس شد (dashboard با جهت‌گیری درست analyticsRead)؛ همچنان سطح نقشه/permission است نه HTTP و سیم‌کشی صفحات را نمی‌بیند |

میانگین کیفی ۴ فایل: **7.9/10** (دور قبل: 6.75).

## ۴) بهداشت DB و محیط (فقط‌خواندنی — `db-look.ts`)

| چک | نتیجه |
|---|---|
| واریانت‌ها: `reserved > 0` | **0 از 60** ✅ · `stock<0` = 0 ✅ |
| رزرو ACTIVE (بی‌سفارش) | **0** ACTIVE در کل جدول → مورد بی‌سفارش هم صفر ✅ |
| کاربر mint از 56/57a/57b | **0** (rbactest/lock57a/sec03/mint/57b/@example.invalid/«تست») ✅ |
| نشست mint | **0** (`testtoken*`/`mint*`؛ کل Session هم 0) ✅ |
| نقش تستی | **۱ ردیف** `test_role_NO_ACCESS/NO_ACCESS` — ⚠️ نه مال 56/57a/57b؛ رسوب **قطعی و ارکسترالِ خودِ `rbac-matrix.test.ts`** است (seedRoleSession هر ران upsert می‌کند و afterAll فقط کاربر را پاک می‌کند؛ isSystem با صفر مجوز، هر ران دوباره استفاده می‌شود) → فقط گزارش، حذفش بی‌فایده است چون ران بعد دوباره می‌سازد |
| AuditLog آزمایشی (lock57a، sec03، 57b، test.audit.entry) | **0** ✅ |
| پرداخت/سفارش MOCK | ۷ ردیف `MOCK-<24hex>` — همه به سفارش وصل؛ **هیچ‌کدام از الگوهای تستی امروز نیستند** (MOCK-57*/sec04/sechard صفر)؛ همان جمعیت «فلوی زندهٔ» قبلی متصل به کاربران seed است که 55-d هم با برچسب عدم‌قطعیت فقط گزارش کرده بود → دست نخورد |
| سفارش مهمان `T*` ۲۴ ساعت اخیر | **0** ✅ (cleanup تست‌های امروز اثباتاً کامل) |
| `/api/health` (پورت 3000) | **HTTP 200** · `db.connected:true` (latency 2ms، uptime 1950s) ✅ · صفحهٔ اصلی 200 |

- من اسکریپت پاکسازی اجرا نکردم — هیچ آلودگی قطعیِ متعلق به 56/57a/57b باقی نبود تا پاک شود.

## ۵) جدول پوشش به‌روز SEC-01..07 + ۸ تعقیبی (مقایسه با 55-d)

| فلگ/فیکس | تست مستقیم (فایل) | غیرمستقیم | 55-d → 57-d |
|---|---|---|---|
| SEC-01 authorize صفحات ادمین | `rbac-matrix.test.ts` (read-matrix 15 مسیر + requirePermission زنده روی DB) | اثبات زندهٔ 57-a/57-b | 🟡 → **🟢** (dashboard/sms/notifications وارد ماتریس شدند؛ سیم‌کشی page.tsx همچنان زنده‌فقط — ذاتی طراحی) |
| SEC-02 منبع IP معتمد | `client-ip.test.ts` (۱۶ تست) | پروب زندهٔ 57-b | 🟡 → **🟢** (شکاف‌های IPv6 بسته شد؛ E2E «XFF جعلی bucket تازه نمی‌سازد» همچنان فقط زنده) |
| SEC-03 سقف per-email ورود ادمین | `admin-signin-ratelimit.test.ts` | اثبات زندهٔ 55-a/57-a | 🟡 → 🟡 (تست تمیزتر و صادق‌تر شد؛ سیم‌کشی اکشن + ردیف audit زنده‌فقط) |
| SEC-04 فاکتور دوم پیگیری | `order-tracking.test.ts` | — | 🟢 → 🟢 (بدون تغییر) |
| SEC-05 سقف بدنهٔ csp-report | `sec-hardening.test.ts` (۳ تست) | — | 🔴 → **🟢** |
| SEC-06 publicApi روی health/media/search | `sec-hardening.test.ts` (۳ تست) | اثبات زندهٔ 57-a/57-b | 🔴 → **🟢** |
| SEC-07 گارد درگاه mock | `sec-hardening.test.ts` (۴ تست) | `order-tracking.test.ts` (منطق proof) | 🔴 → **🟢** (مسیر «نشست مالک» و PAID همچنان بی‌تست) |
| F55-1 گارد داشبورد | `rbac-matrix.test.ts` (ردیف نقشه) | زندهٔ 57-a/57-b | جدید → 🟢 (نقشه) / سیم‌کشی زنده‌فقط |
| F55-2/3/4 سخت‌سازی client-ip | `client-ip.test.ts` (۵ تست جدید) | پروب زندهٔ 57-b | جدید → 🟢 |
| F55-5 خواندن bounded csp | `sec-hardening.test.ts` (تست chunked) | زندهٔ 57-a (مرز 4096/4097) | جدید → 🟢 |
| F55-6 هدر Retry-After | `sec-hardening.test.ts` (هر ۳ تست) | زندهٔ 57-b (۴ مقدار صحیح) | جدید → 🟢 |
| F55-7 sms/notif به map + scope=per-ip | `rbac-matrix.test.ts` (sms/notif) | scope=per-ip فقط زندهٔ 57-a | جدید → نیمه‌🟢 |
| F55-8 (خود فایل‌های تست) | همین چهار فایل | — | ✅ اجرا و ارزیابی شد |

- **ردیف‌هایی که 🔴→🟢 شدند: SEC-05، SEC-06، SEC-07** (سه فلگِ بی‌تست دور قبل). SEC-01 و SEC-02 هم از 🟡 به 🟢 ارتقا یافتند. تنها 🟡 باقی‌مانده: SEC-03 (به‌دلیل مرز next/headers — مستند).

## ۶) جمع‌بندی

1. ادعاهای ۴گانهٔ Task 56 **مستقل بازتأیید شد**: unit 172/172 ✅ · integration 56/56 (دو بار، عین هم) ✅ · lint بدون خطا ✅ · typecheck در سطح src/tests بدون خطا ✅ — flaky: **خیر** (واریانس زمان 11٪، نتیجه صفر).
2. تنها انحراف: EXIT=2 خامِ typecheck و ۹ هشدار lint، هر دو **منحصراً از فایل‌های اسکرچ باقی‌ماندهٔ 56/57a/57b در `qa-reports/tmp-*`** (tsconfig الگوی `**/*.ts` را include می‌کند و `qa-reports` را exclude نمی‌کند) — رگرسیون کد نیست؛ پیشنهاد بهداشتی یک‌خطی برای فرمانده: افزودن `"qa-reports"` به exclude تایپ‌کریک/eslint.
3. پوشش تستی فاز ۱ از «۳ فلگ بی‌تست» به «پوشش مستقیم هر ۷ فلگ + هر ۸ تعقیبی (به‌جز دو جزء زنده‌فقطِ مستند)» رسید — میانگین کیفیت 4 فایل از 6.75 به **7.9**.
4. DB سالم: reserved=0، رزرو ACTIVE=0، mint/audit/سفارش آزمون امروز = صفر؛ دو رسوب بی‌ضررِ مستند (نقش test_role_NO_ACCESS ساخت خودِ rbac-matrix، و ۷ پرداخت MOCK متعلق به فلوی زندهٔ قبلی) فقط گزارش شد.
