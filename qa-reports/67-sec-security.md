# گزارش ممیزی امنیتی — Task 67-sec (باتری نهایی، فازهای ۳–۶)

- **ممیزی:** امنیت · **بازهٔ دیف:** `35bc307~5..HEAD` (۴۹۶ کامیت فاز ۲ تا ۶ = فازهای ۳،۴،۵،۶ + follow-up فاز ۲)
- **روش:** بازخوانی کد + اسکن الگویی دیف + پروب زندهٔ مجاز روی `http://localhost:3000` (بدون تغییر داده، بدون ری‌استارت سرور)
- **قاعدهٔ راز:** هیچ مقدار راز/رمزی در این گزارش نیامده؛ ارجاع‌ها فقط نام کلید env هستند.

---

## ۱) اسکن راز روی دیف — ✅ پاک

- گرپ تجویزی (`password|secret|token|key|salt`) روی کل دیف: فقط **ارجاع قانونی env** (`PAY_PROOF_SECRET`، `OTP_HASH_SALT`، `SERVER_ACTIONS_ALLOWED_ORIGINS`، `NEXT_PUBLIC_SITE_URL`، `ZARINPAL_REFUND_ENABLED`، `ALLOW_MOCKS_IN_PRODUCTION`)، اتریبیوت‌های React `key=` و کلیدهای rate-limit. **هیچ مقدار خامی اضافه نشده.**
- اسکن عمیق‌تر (نشت اعتبارنامه در URL، AKIA، بلاک کلید خصوصی، انتساب رشته‌ای ثابت به secret): پاک.
- `prima_dev_only` (رمز داکر dev محلی) فقط در جای مجاز: `docker-compose.yml`، `.env.example`، `tests/integration/*` (inject با `process.env.DATABASE_URL ??`)، `scripts/pg.sh`، `qa-reports/tmp-60` — **در src/ ران‌تایم صفر.**
- ⚠️ درس تکرار باتری ۶۰: گرپ انگلیسی‌محور رازِ فارسی‌برچسب را نمی‌گیرد؛ اسکن الگومحور (`://user:pass@`، `admin@`، انتساب ثابت) هم اجرا شد → پاک.

## ۲) INFRA-09 — کوکی اثبات HMAC — ✅

- `paidProofValue` دیگر `sha256(authority)` بی‌کلید نیست: **HMAC-SHA256(PAY_PROOF_SECRET, authority)** (checkout-service.ts:358).
- تولید بدون کلید در production **ناممکن**: `payProofSecret()` بدون `PAY_PROOF_SECRET` → throw (fail-fast)؛ fallback dev فقط خارج production.
- مقایسهٔ `isValidProof` زمان-ثابت با چک طول؛ مصرف‌کننده‌ها: صفحهٔ success (اثبات + آخرین authority پرداخت) و mock-gateway.
- کوکی: `httpOnly`، `sameSite=lax`، `secure` در prod، TTL ۱۵ دقیقه، path=/.
- **تست‌ها سازگار:** `order-tracking.test.ts` و `sec-hardening.test.ts` از همین تابع استفاده می‌کنند (بدون فرض sha256 بی‌کلید)؛ اثبات جعلی → null.
- 🟡 نیت: کامنت مستند checkout-service.ts (~خط 400) هنوز «sha256(authority)» می‌گوید — به‌روزرسانی واژگان HMAC.

## ۳) INFRA-03 — csp.ts — ✅

- production: **ENFORCE واقعی** (`reportOnly: !isProduction`) با **nonce تازه به‌ازای هر request** (`randomUUID` base64 در proxy.ts:60) + `strict-dynamic`، **بدون unsafe-eval**؛ تست unit هر دو مود را قفل می‌کند (tests/unit/csp.test.ts).
- هدر روی **request هم** ست می‌شود (`Content-Security-Policy` + `x-nonce`) تا Next nonce را به bootstrap تزریق کند (الگوی رسمی)؛ `withCsp` روی همهٔ خروج‌ها حتی early-returnهای گارد ادمین (باگ میانی فاز ۶ بسته).
- dev: Report-Only با unsafe-inline/eval برای HMR — زنده تأیید شد (هدر `content-security-policy-report-only` روی /).
- باز مانده‌های مفید (همه مستند): `style-src 'unsafe-inline'` (استاندارد Next)، `img-src https:` (کاندیدای سخت‌سازی آینده)، نبود frame-src → default-src 'self'. `frame-ancestors 'none'`، `object-src 'none'`، `base-uri/form-action 'self'` ✓ + Reporting-Endpoints.
- CSP-N1: خطای reader گزارش → 204 بدون 500 ✓.

## ۴) BUG-14 — گارد Origin روی POST — ✅ با یک advisory

- گارد روی **همهٔ POSTها** در proxy.ts (matcher همه‌مسیر غیراستاتیک؛ تنها route POST صریح = csp-report، بقیه Server Actionها هم از همان لایه می‌گذرند).
- **پروب زنده:** `POST /api/csp-report` با `Origin: https://evil.example` + `Host: localhost:3000` → **403 JSON تمیز** `FORBIDDEN_ORIGIN` (نه 500 خام).
- Origin غایب/`null` عمداً به فریم‌ورک واگذار می‌شود (مستند در کد).
- 🟠 **Advisory (LOW — دور زدن گارد دفاع دوم):** درخواست مستقیم با `x-forwarded-host` جعلیِ هم‌ترازِ Origin از گارد رد می‌شود (پروب زنده: `Origin: https://evil.example` + `x-forwarded-host: evil.example` → گارد رد شد و هندلر 204 داد) — چون `isAllowedOrigin` تساوی `originHost === host` را با هدر کلاینت‌کنترل می‌سنجد. **تشدیدکنندهٔ عدم:** این گارد صرفاً defense-in-depth است؛ کنترل اصلی CSRF = کوکی‌های `SameSite=Lax` هر دو نشست (مشتری + ادمین، سنجیده شد) + origin-check ذاتی Server Actionهای Next؛ پیش‌نیاز دیپلوی (مستند در client-ip.ts/INFRA-06): پروکسی معتمد `x-forwarded-host` را بازنویسی می‌کند. **توصیه:** هنگام عدم تنظیم TRUSTED_PROXY، هدر Host مبنا باشد و XFH کلاینت نادیده گرفته شود (هم‌راستا با سیاست client-ip).

## ۵) SEC-13/09 — fail-fast ها — ✅

- fallback هاردکد `DATABASE_URL` در src حذف → fail-fast با پیام راهنما؛ دیف حذف را نشان می‌دهد.
- `grep -rn "prima_dev_only|prima-dev-salt" src` → **فقط** `otp.ts:61` (برنچ dev با گارد production) — همان جای مجاز policy.
- `hashOtpCode`: بدون `OTP_HASH_SALT` در production → crash-fast ✓؛ سقف تلاش OTP اتمیک (updateMany شرطی) ✓.

## ۶) INFRA-08/2 — profile.self — ✅

- `changeOwnPasswordAction` پشت `PERMISSIONS.profileSelf` (مجوز اختصاصی؛ در roles.ts به ۶ نقش ادمین داده شده و sync شده).
- **فقط رمز خودش:** خواندن/آپدیت روی `ctx.actor.userId` قفل است — هیچ پارامتر id بیرونی پذیرفته نمی‌شود؛ اثبات رمز فعلی + رد رمز تکراری + revoke بقیهٔ نشست‌ها (حفظ نشست جاری) + audit.

## ۷) ریت-لیمیت callback — ✅ (اثبات زنده با دیفرانسیل لاگ)

- کد: سقف سبک `checkout-callback` با `RATE_RULES.publicApi` (120/min) قبل از هر کوئری؛ مسیر سقف همان 307 خطا را می‌دهد (بدون افشا).
- **پروب زنده:** فلود ۱۳۰× `GET /checkout/callback?authority=FAKE-…` → هر ۱۳۰ پاسخ 307 یکدست؛ **dev.log دقیقاً ۱۲۰ خط warn «checkout callback domain error»** دارد → ۱۰ درخواست آخر ارزان و قبل از هندلر رد شدند (سقف 120 فعال) و هیچ استک/جزئیاتی بیرون نشت (BUG-12).

## ۸) پروب‌های زندهٔ مجاز — ✅

| پروب | نتیجه |
|---|---|
| health ×۶۱ | دقیقاً ۶۰×200 سپس **429 + Retry-After: 58** (سقف مستقل healthCheck=60) |
| csp-report بدنه 100KB | با Content-Length و chunked (بدون CL) هر دو **204**؛ سقف 4KB مسیر سریع + cancel استریم (CR-5) |
| search ×۳۱ → سپس XFF جعلی | 30×200 سپس 429؛ با `x-forwarded-for: 1.2.3.4` و `x-real-ip: 9.9.9.9` **همچنان 429** (fail-closed bucket اشتراکی — هدر جعلی bucket تازه نمی‌سازد؛ SEC-02) |
| order-tracking IDOR | کد واقعی+موبایل غلط و کد غلط+موبایل واقعی → **پیام یکسان «یافت نشد»** (بدون نشت وجود سفارش)؛ کنترل مثبت جفت درست → صفحهٔ سفارش؛ کد بدون موبایل → راهنمای حریم خصوصی. سقف 30/min فقط روی تلاشِ دارای کد |
| کد سفارش پروب‌شده | 2980700292 (سفارش تستی سندباکس) — شمارهٔ موبایل‌ها در گزارش نیامده |

## ۹) SEC-11 — devCode — ✅

- `includeDevCodeInResponse()`: شرط ثابت بیلد (`NODE_ENV !== "production"` → true؛ production → literal false) → در بیلد prod مسیر dead-code-eliminate می‌شود؛ در dev پاسخ OTP همچنان `devCode` دارد (مسیر تست سالم). دموی prod از provider mock پیامک می‌گیرد نه پاسخ API.

---

## یافته‌های محیطی (خارج از دیف فازهای ۳–۶)

- 🔴 **F-A (عملیاتی — نیازمند چرخش):** Next 16 در مود dev آرگومان Server Actionها را لاگ می‌کند؛ در dev.log ساعت 14:24 **رمز جاری ادمین به‌صورت متن خام** در خط `adminLoginAction({...})` دیده شد (تطبیق آن با فایل راز به‌صورت خاموش سنجیده شد — مقدار در هیچ گزارشی بازتولید نشده). `dev.log` gitignored/غير‌tracked است (نشت ریپویی نیست) و با ری‌استارت 14:27 truncate شد، اما **هر لاگین dev بعدی دوباره آن را می‌نویسد**. پروDUCTION بی‌تأثیر است (لاگ arg فقط dev است). توصیه: چرخش رمز پس از پایان کار سندباکس + پاک‌سازی/جلوگیری از لاگین dev با رمز واقعی.
- 🟡 **F-B (پایداری محیط):** سرور طی ممیزی دو بار افتاد/بالا آمد (14:24–14:31) بدون ردپای crash در dev.log — هم‌خوان با هشدار هم‌زمانی ایجنت‌های موازی (درس باتری ۶۰). یک پروب موقتاً مسدود شد و پس از بازگشت سرور اجرا شد.
- 🟡 **F-C (نیت):** کامنت کهنهٔ «sha256(authority)» در checkout-service.ts (~400) → اصلاح واژگان.

## رأی

> **PASS** — هر ۹ آیتم چک‌لیست تأیید شد (کد + تست + پروب زنده). بدون یافتهٔ بلوکه‌کنندهٔ کدی.
> شرط عملیاتی: چرخش رمز ادمین (F-A) پیش از هر push/اشتراک‌گذاری لاگ — خارج از دیف فازهای ۳–۶ ولی فوری.
