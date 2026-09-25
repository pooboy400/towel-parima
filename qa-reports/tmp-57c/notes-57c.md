# یادداشت‌های شواهد 57-c (بازبینی سفید‌جعبه فیکس‌های Task 56)

تاریخ: ۱۴۰۵/۰۷/۰۴ · روش: خواندن خط‌به‌خط + ۲ پروب فقط‌خواندنی bun در پروسهٔ جدا (بدون تغییر کد/env سرور/DB)

## شواهد پروب ۱ — extractClientIp (probe-57c-client-ip.ts)

| # | ورودی | خروجی | نتیجه |
|---|-------|-------|-------|
| A7c | CIDR=10/8 + `x-real-ip: "9.9.9.9 "` | `"9.9.9.9 "` (خام، بدون trim) | **یافتهٔ 2 تأیید** — کلید bucket غیرکانونی؛ client-ip.ts:211 |
| A7d | `x-real-ip: "\t9.9.9.9"` | `"\t9.9.9.9"` (خام) | همان یافته |
| B1 | CIDR=10/8 + XFF `2001:DB8::1` | `"2001:DB8::1"` (raw) | یافتهٔ جدید خرد: خروجی IPv6 کانونی نمی‌شود (کلید غیرکانونی) |
| B2 | CIDR=2001:db8::/32 + XFF `2001:DB8::99` | null (معتمد) | تطبیق باینری case-insensitive ✔ (فقط «خروجی» خام است) |
| C1 | CIDR=`10.0.0.1/8` + XFF `10.50.1.1` | null (معتمد) | host-bits روشن → mask می‌شود (سیاست انتخابی؛ مستند در کامنت اینترفیس :45) |
| C2 | CIDR=`10.0.0.0/032` + XFF `1.2.3.4` | `"1.2.3.4"` (untrusted) | یعنی /032 پذیرفته شد = /32 → ۵-۲ تأیید؛ client-ip.ts:123-124 |
| D4 | CIDR=`::ffff:10.99.0.0/112` + XFF `10.99.0.9` | `"10.99.0.9"` (untrusted) | تلهٔ mapped/v4 تأیید (۵-۳) — در .env.example هنوز هشدار ندارد |
| D4b | همان CIDR + XFF `::ffff:10.99.0.9` | null (معتمد) | — |
| E1 | XFF `"  1.2.3.4  , 9.9.9.9"` | `"9.9.9.9"` (trim‌شده) | نامتقارن با x-real-ip — مسیر XFF در :205 trim می‌کند |
| F1 | بدون CIDR + XFF سالم | null | fail-closed حالت مستقیم پابرجا (:201) |

## شواهد پروب ۲ — ریاضی بایت ipv6ToBigInt (probe-57c-ipv6-math-output.txt)

- `2001:db8::1` → `20010db80000…0001` ✔ (محاسبهٔ دستی تأیید)
- `::ffff:1.2.3.4` → `…ffff01020304` ✔ (دم v4 به دو گروه 102:304 بازنویسی و در جایشان نشسته)
- `0:0:0:0:0:0:0:1` ≡ `::1` ≡ `1` ✔ — کانونی‌سازی باینری درست
- رد صحیح: `%zone`، `[bracket]`، ۹ گروه، دو `::`، گروه ۵رقمی
- ⚠️ کشف خرد: `::ffff:01.2.3.4` در **خودِ** ipv6ToBigInt پذیرفته می‌شود (isIPv4 داخلی صفر پیشرو را می‌پذیرد) — اما در هر ۳ مسیر production (isPlausibleClientIp:187 / parseCidr:114 / isTrusted:174) گیت `net.isIP` **قبل** از آن اجرا می‌شود و صفر پیشرو را رد می‌کند (isIP=0) → در سیم‌کشی فعلی بی‌اثر؛ فقط اگر روزی این تابع بدون گیت isIP بازاستفاده شود قابل‌رسیدن است (نکتهٔ دفاع-در-عمق).

## راستی‌آزمایی نکتهٔ 57-a دربارهٔ cancel-بی‌لاگ (کد + شواهد زندهٔ 57-b)

- `readBodyCapped` (csp-report/route.ts:27-54): `total > cap` اکید → 4096 inclusive خوانده می‌شود، 4097 cancel → شاخهٔ capped :75-78 → 204 بدون هیچ رکوردی. ✔ با اثبات زندهٔ 57-b (مرز 4096/4097) سازگار.
- بدنهٔ 2048..4096 بایت که parse شود → رکورد متادیتای `csp_violation_oversized` با size≈سقف (:83-94) — «رکورد oversized با size≈سقف» همان این باند است.

## نکات دیگر جمع‌شده

- csp-report: خطای `reader.read()` (abort کلاینت) catch نمی‌شود → 500 خام + بدون cancel/releaseLock در آن شاخه (:36-45) — یافتهٔ جدید پایین.
- decode UTF-8: بایت‌ها اول merge می‌شوند (:47-52) و یک‌بار decode → mojibake مرز chunk **ندارد** ✔ (ادعای بررسی‌شده در دستور کار — رد شد).
- Content-Length قبل از خواندن چک می‌شود (:68-71) و CL غایب/NaN → مسیر bounded ✔؛ CL منفی/غول در لایهٔ HTTP رد می‌شود (57-b).
- Retry-After: هر سه محل `Math.max(1, Math.ceil(retryAfterMs/1000))` — limiter در حالت blocked همیشه retryAfterMs>0 می‌دهد (in-memory.ts:44، چون lazy-clean stamps[0] > windowStart) → حداقل 1 ثانیه تضمین؛ فقط داخل `if (!rl.ok)` یعنی فقط 429 ✔ (health:24، media:38، search:27).
- یافتهٔ 1 (اشباع مانیتور): health:17 به `RATE_RULES.publicApi` (policies.ts:40 = 120/min) بسته است؛ مانیتور ≈125/min → خودش 429 می‌گیرد و در حالت direct کل bucket «unknown» را نگه می‌دارد. تأیید.
- page-read-map:13 مجوزها = requireAny semantics؛ page-guard:31 با `.some` هم‌راستا؛ API notifications:26-29 `requireAnyPermission` با همان سه‌تایی → صفحه/API/تست هم‌خوان.
- requirePageAccess قبل از کوئری DB: dashboard :55 (کوئری‌ها :59+)، sms :19 (کوئری :21)، notifications :23 (کوئری :25) ✔
- account فقط-احراز مستند در page-read-map.ts:15-18 + page-guard.ts:24 + tasks.md F55-7؛ no-access فقط احراز (anti-حلقه :11-17، لینک شرطی داشبورد :28).
- actions.ts:84 `after:{scope:"per-ip"}` ✔ (CR-10). نکته: کلید گیت دوم `admin-signin:{ip}:{email}` است (:73) — برچسب per-ip تقریبی است (طراحی از پیش موجود، policies.ts:21-22 آن را «per IP+شناسه» مستند کرده).
- tasks.md: ردیف‌های F55-1..8 تیک‌خورده (بخش «تعقیبی ۵۵» خطوط 36-47) ✔؛ INFRA-09 از CR-6 در فاز ۶ (خط 132) ✔؛ CR-9 با کامنت صادقانه در admin-signin-ratelimit.test.ts:15-19 ✔؛ CR-10/CR-7/CR-8/CR-1..5 با F55ها ✔؛ CR-11 = SEC-10 فاز ۳ (خط 69) ✔؛ **CR-12 هیچ‌جا ردیابی نشده** (نکتهٔ PII در query پیگیری — خرد).
- .env.example:5-13 مستندسازی F55-2/3/4 ✔؛ فقط هشدار ۵-۳ (mapped CIDR) هنوز ندارد.
