# گزارش فرانت‌اند — Task 67-fe (باتری نهایی UI/UX فاز ۴–۶)

- **تاریخ:** ۱۴۰۴-۰۷-۰۵ · **بررسی‌کننده:** ایجنت فرانت‌اند (67-fe)
- **محدوده:** UX-05/04/11/07/09/02/03 + ژورنال (SEO-02/03) + FAQ (SEO-01) + رگرسیون RTL/اسکلتون/حالت خالی
- **روش:** بازبینی کد + بررسی زندهٔ http://localhost:3000 (curl + مرورگر واقعی موبایل ۳۹۰px و دسکتاپ ۱۴۴۰px)
- **شواهد تصویری:** `tmp-67-fe/` (m1…m6، d1)
- **یادداشت محیطی:** سرور dev در میانهٔ بررسی ۲ بار افتاد (فشار منابع / ایجنت‌های موازی — fork: Resource temporarily unavailable) و پس از بازیابی ادامه داده شد؛ هیچ اقدام مداخله‌ای روی سرور انجام نشد.

---

## ۱) UX-05 — کنتراست terracotta — 🟠 یک یافتهٔ MEDIUM باقی است

**محاسبات WCAG (نسبت‌های واقعی):**

| ترکیب | نسبت | نتیجه |
|---|---|---|
| bg `#9c6440` + متن سفید (variant دکمهٔ terracotta) | **۴.۸۷** | ✅ ≥۴.۵ |
| hover `bg-terracotta-deep #8f5c3b` + سفید | **۵.۵۸** | ✅ |
| متن terracotta روی cream `#f8f6f2` | **۴.۵۱** | ✅ (کم‌ترین حاشیه) |
| لینک terracotta روی surface سفید (بنر wishlist — wishlist-view.tsx:42) | **۴.۸۷** | ✅ |
| متن terracotta-deep روی cream/white | ۵.۱۷ / ۵.۵۸ | ✅ |
| sage `#56745f` روی white/cream | ۵.۱۷ / ۴.۷۹ | ✅ |
| **متن terracotta روی bg-deep تیره (about/page.tsx:161 — ابرک «تعهد ما»)** | **۲.۴۲** | 🔴 FAIL |
| آیکون‌های terracotta روی `bg-cream/10` داخل بخش تیره (about:180) | ≈۲.۴–۲.۵ | 🟡 حاشیه‌ای (آیکون تزئینی aria-hidden) |

**شواهد:**
- globals.css:43-44 توکن‌ها + کامنت UX-05؛ button.tsx:18-19 → `bg-terracotta text-white hover:bg-terracotta-deep` ✅
- greep کل src: تنها جایگذاری متنیِ مشکل‌دار روی پس‌زمینهٔ تیره، ابرک «تعهد ما» در `about/page.tsx:161` است (بخش `bg-deep text-cream`). سه ترکیب ادعاشده در کارلاگ (دکمه، متن روی روشن، لینک بنر) همگی پاس هستند.
- کنتراست‌های عددی با اسکریپت luminance WCAG محاسبه شد (خروجی بالا).

**پیشنهاد:** برای سطوح تیره از `text-sand` (۴.۸۸ روی deep) یا نسخهٔ روشن‌تر terracotta استفاده شود؛ یک‌خطی CSS token جدید `--color-terracotta-light`.

---

## ۲) UX-04 — ردیف «سود شما از قیمت مصوب» — ✅ PASS (کد + زنده)

- **کد:** cart-view.tsx:170-179 — ردیف فقط وقتی `totals.discount>0` ظاهر می‌شود، برچسب «سود شما از قیمت مصوب»، رنگ `text-sage`. cart-logic.ts:59 → `total = subtotal + shipping` (سود در مبلغ قابل پرداخت اثر ندارد — دیگر ادعای «تخفیف فاکتور» نیست).
- **زنده (موبایل، خط تستی با compareAtPrice=۳۴۰٬۰۰۰ / price=۲۸۳٬۰۰۰):**
  `جمع کالاها ۲۸۳٬۰۰۰ | سود شما از قیمت مصوب ۵۷٬۰۰۰ | هزینهٔ ارسال ۸۹٬۰۰۰ | مبلغ قابل پرداخت ۳۷۲٬۰۰۰`
  → ریاضی فاکتور درست (۲۸۳+۸۹=۳۷۲). رنگ رندرشده: `rgb(86,116,95)` = دقیقاً `#56745f` (۵.۱۷ روی سفید ✅). شاهد: `tmp-67-fe/m6-cart-savings-row.png`
- **خوانش با چک‌اوت:** چک‌اوت (checkout-client.tsx:506-531) فقط «جمع کالاها / تخفیف (کد) / ارسال / مبلغ قابل پرداخت» را نشان می‌دهد — تفکیک مفهومی «سود قیمت مصوب» (cart) از «تخفیف کوپن واقعی فاکتور» (checkout) تمیز و بدون تناقض است. ✅

---

## ۳) UX-11 — آیکون‌ها — ✅ PASS

- فایل‌ها موجود: `src/app/favicon.ico` (ICO سه‌سایزی با sharp) + `icon.svg` + `apple-icon.png`
- `curl -sI` زنده: `/favicon.ico` → **200**، `/icon.svg` → **200**، `/apple-icon.png` → **200**
- head صفحهٔ اصلی (بدون هیچ تنظیم اضافهٔ metadata — قرارداد فایل Next کافی است):
  `<link rel="icon" href="/favicon.ico?..." sizes="48x48">` + `<link rel="icon" href="/icon.svg?..." type="image/svg+xml">` + `<link rel="apple-touch-icon" href="/apple-icon.png?..." sizes="180x180">` ✅
- نکتهٔ جزئی: metadataBase به دامنهٔ production اشاره می‌کند ولی برای آیکون‌ها بی‌اثر است.

---

## ۴) UX-07 — Toaster top-left در موبایل — ✅ قابل‌قبول، 🟡 یک نکته

- layout.tsx:104-113 → `<Toaster position="top-left" dir="rtl">` با فونت وزیرمتن و شعاع برند.
- **زنده (iPhone 14 / ۳۹۰px):** توست «از علاقه‌مندی‌ها حذف شد» در `data-y-position=top / data-x-position=left`، هندسهٔ واقعی: `x:16, y:16, w:358, h:53.5` (تقریباً تمام‌عرض). شاهد: `tmp-67-fe/m3-toast-topleft-mobile.png`
- 🟡 **تداخل با هدر در موبایل:** هدر sticky با ارتفاع ۶۴px است؛ توست در y=16 تا 69.5 دقیقاً روی نوار آیکون‌های جستجو/سبد (سمت چپ در RTL) می‌نشیند و در بالای صفحه روی AnnouncementBar. چون توست گذراست (~۴ ثانیه) و مشکل قبلی (پوشاندن دکمهٔ action در bottom-center) بدتر بود، وضعیت قابل‌قبول است؛ برای ۱۰/۱۰ پیشنهاد می‌شود `offset={{ mobile: 72 }}` اضافه شود.
- دسکتاپ: گوشهٔ بالا-چپ، بدون پوشش ناوبری مرکزی. ✅

---

## ۵) UX-09 / UX-02 — پروفایل و خطای آدرس — ✅ با دو نکتهٔ 🟡

- **UX-09 نام (account-panels.tsx:388-410):** `label htmlFor="customer-name"` + `Input id="customer-name"` ✅، دکمهٔ ذخیره با وضعیت pending/saved، پیام‌های فارسی ۲..۸۰ نویسه از اکشن سرور. PASS.
- **UX-02 خطای کدپستی (AddressDialog:284-300):** `aria-invalid={fieldError ? true : undefined}` ✅ + `<p role="alert">` زیر فیلد ✅ + پاک‌شدن خطا هنگام تایپ ✅. Field در checkout (خط ۵۵۶-۵۶۰) هم `role="alert"` دارد ✅.
- 🟡 **نکتهٔ a11y (LOW):** در `Field` هر دو فرم آدرس/چک‌اوت، `Label` بدون `htmlFor` و Input بدون `id` است (برچسب‌ها با اسکرین‌ریدر به فیلد وصل نمی‌شوند) و پیام خطا با `aria-describedby` به input لینک نشده. رفع: افزودن id یکتا + htmlFor + aria-describedby.
- 🟡 خطای سرور مستقل از فیلد همیشه زیر «کد پستی» نمایش داده می‌شود — در عمل پیام اسکیما همان کدپستی است (BUG-13) ولی اگر روزی خطای فیلد دیگری برگردد جای نمایش گمراه‌کننده می‌شود.

---

## ۶) UX-03 — مهمان/bج/hydration — ✅ PASS (زنده)

- **بنر مهمان /wishlist (زنده، مهمان با یک آیتم):** «این لیست روی همین دستگاه ذخیره شده — **با ورود به حساب** (لینک terracotta با underline) روی همهٔ دستگاه‌های شما در دسترس خواهد بود.» شاهد: `tmp-67-fe/m2-wishlist-guest-banner.png` ✅
- **بج هدر:** افزودن با قلب در /shop → `aria-label="علاقه‌مندی‌ها (1 محصول)"` فوراً؛ حذف در /wishlist → بج به «علاقه‌مندی‌ها» برگشت ✅ (هم‌زمان توست تأیید حذف). بج‌ها `bg-terracotta text-white` با موقعیت منطقی `-end-0.5` (RTL-aware).
- **Hydration:** `useMounted` با `useSyncExternalStore` (الگوی رسمی React، بدون setState-in-effect)؛ header.tsx:43-46 مقادیر localStorage را تا mount با ۰ نشان می‌دهد؛ wishlist-view آیتم‌ها را تا mount خالی رندر می‌کند؛ CartSync بعد از لود برای مشتری `hydrateFromServer` را صدا می‌زند (حقیقت سرور برای دستگاه دوم). کنسول دسکتاپ: **هیچ هشدار hydration mismatch وجود ندارد** ✅.
- wishlist-store فقط برای مشتری لاگین `serverToggle` می‌زند (مهمان = localStorage) ✅.

---

## ۷) ژورنال — ✅ PASS با دو نکتهٔ 🟡

- **سلسله‌مراتب (زنده در ۵ مقاله):** h1 عنوان → h2 بخش‌ها → h3 زیربخش‌ها؛ فوتر/aside h2-h3 منطقی. gsm-explained: `h1 «GSM چیست و چرا عدد وزن حوله مهم است؟»` + `h2 «GSM، بافت و جنس — یک‌نگاه»` ✅
- **figure:** همهٔ تصاویر (شاخص و درون‌متنی) `<figure class="aspect-[16/9]">` + `next/image` با fill/sizes ✅
- **CTA اختصاصی (SEO-03) — هر ۵ مقاله متفاوت و زنده:**
  gsm: «GSM، بافت و جنس — یک‌نگاه» · choose: «راهنمای انتخاب حوله — خلاصه و عملی» · wash: «حوله‌هایتان را مثل روز اول نگه دارید» · kids: «انتخاب امن برای پوست کودک» · gift: «هدیه‌ای که سال‌ها می‌ماند» ✅
- 🟡 **(LOW)** ادعای SEO-02 فقط ۳/۵ مقاله تصویر درون‌متنی دارند (choose/wash/kids)؛ gsm و gift فقط تصویر شاخص (figure count=1 زنده).
- 🟡 **(LOW)** alt درون‌متنی قالبی است: «{عنوان} — تصویر توضیحی 8» — «توصیفی» واقعی نیست.
- 🟡 **(LOW)** در gsm-explained متن ctaTitle با h2 بدنه یکسان است → دو h2 هم‌متن در یک صفحه (دادهٔ seed؛ بهتر است CTA متفاوت باشد).

---

## ۸) FAQ — ✅ PASS

- **JSON-LD زنده (parse موفق):** ۲ بلاک ld+json؛ بلاک دوم `@type: FAQPage` با **۷ Question/acceptedAnswer** — JSON معتبر ✅
- **بلاک sr-only در HTML اولیه:** `<div class="sr-only" aria-hidden="false"><h2>پاسخ سؤالات پرتکرار</h2><h3>…هر سؤال…</h3><p>…پاسخ…</p>…</div>` — خزندهٔ بدون JS محتوا را می‌بیند ✅ (accordion = JS-only محتوا را نمی‌پوشاند)
- ⚪ (INFO) بلاک sr-only قبل از h1 صفحه در DOM است (اولین heading صفحه h2 می‌شود) — جزئی؛ `aria-hidden={false}` زائد ولی بی‌ضرر.

---

## ۹) RTL / اسکلتون / حالت خالی — ✅ PASS

- **RTL:** `<html lang="fa" dir="rtl">`؛ موقعیت‌دهی‌های منطقی (`-end-0.5`، `start-0`، `me/ms`) در header/menu؛ snapshotهای زندهٔ /shop، /wishlist، /cart همگی ترتیب و تراز فارسی درست (m1…m6). بج‌ها با `-end-0.5` در RTL سمت درست می‌نشینند.
- **اسکلتون:** صفحات ویترین server-rendered/ISR هستند و loading.tsx ندارند (نیازی هم نیست)؛ بخش‌های client-sensitive (بج‌ها، wishlist، سبد) با useMounted گیت می‌شوند → بدون mismatch و بدون پرش چیدمان مشاهده شد. Skeleton component فقط در ادمین (sidebar) استفاده می‌شود.
- **حالت خالی (زنده):** /cart خالی → پیام + CTA «مشاهده محصولات» (m5)؛ /wishlist خالی → پیام + CTA (m4)؛ آدرس‌ها و سفارش‌های اکانت هم empty-state دارند (کد). ✅
- ⚪ (INFO) هشدار dev روی home: تصویر LCP `/images/p-cream.jpg` بدون `priority`/eager — صرفاً بهینه‌سازی.

---

## جمع‌بندی شدت‌ها

| # | شدت | یافته | محل |
|---|---|---|---|
| 1 | 🟠 MEDIUM | متن terracotta روی پس‌زمینهٔ تیره (کنتراست ۲.۴۲) | about/page.tsx:161,180 |
| 2 | 🟡 LOW-MED | توکن تعریف‌نشدهٔ `text-sand-deep` (کلاس در CSS نهایی تولید نمی‌شود — تأیید در CSS کامپایل‌شده) | account-panels.tsx:132، bestseller-card.tsx:17، orders-manager.tsx:45 |
| 3 | 🟡 LOW | برچسب‌های فرم آدرس/چک‌اوت بدون htmlFor/id و خطا بدون aria-describedby | account-panels.tsx Field، checkout-client.tsx:551 |
| 4 | 🟡 LOW | توست موبایل تقریباً تمام‌عرض روی هدر sticky (گذرا) — پیشنهاد offset موبایل | layout.tsx:104 |
| 5 | 🟡 LOW | ژورنال: ۲/۵ مقاله بدون تصویر درون‌متنی + alt قالبی + ctaTitle تکراری gsm | seed-data/content.ts |
| 6 | ⚪ INFO | sr-only قبل از h1 · LCP بدون priority | faq/page.tsx:39، home |

## رأی نهایی: **PASS** (مشروط به هیچ آیتم بلوکه‌کننده نیست — ۵ یافتهٔ 🟡/🟠 به بک‌لاگ پیشنهاد می‌شود)
