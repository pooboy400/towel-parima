# Task 11 — Senior Frontend Developer — Work Record

> نکته: مسیر ریشه /agent-ctx قابل ساخت نبود (Permission denied)؛ رکورد در agent-ctx داخل پروژه ذخیره شد.

## انجام‌شده
- ساخت ۱۳ فایل جدید برای صفحات محتوایی فروشگاه پریما (هیچ فایل موجودی ویرایش نشد):
  - src/app/about/page.tsx — داستان برند، hero، ۳ پاراگراف، ۳ کارت ارزش ادیتوریال، بخش تعهد bg-deep با آیکون‌های lucide، CTA به /shop
  - src/app/contact/page.tsx + contact-form.tsx — اطلاعات تماس از storeConfig + فرم کلاینت با Zod (contactFormSchema)، خطای inline، toast.success، reset
  - src/app/faq/page.tsx — getFaq() + shadcn Accordion (single/collapsible) + کارت کمکی به /contact
  - src/app/journal/page.tsx — featured افقی + گرید ۲ ستونه، تاریخ فارسی/زمان مطالعه
  - src/app/journal/[slug]/page.tsx — generateStaticParams + generateMetadata + notFound + CTA + ناوبری قبلی/بعدی
  - src/app/account/page.tsx — placeholder ورود (disabled) + noindex + کامنت فاز 2 (NextAuth)
  - src/app/shipping/page.tsx، returns، privacy، terms — هرکدام مستقل، متن واقعی ۳-۵ پاراگراف
  - src/app/order-tracking/page.tsx + tracking-form.tsx — فرم کد رهگیری/موبایل با toast.info فاز 2 + noindex

## نکات فنی
- order-tracking نیاز به page سرور (metadata/noindex) + فرم کلاینت داشت → الگوی contact (دو فایل) تکرار شد
- tel: با ارقام لاتین ساخته می‌شود تا در دیالر موبایل کار کند
- lint: بدون error (exit 0) — tsc --noEmit: بدون خطا در src/
- curl از sandbox شِل به پورت 3000 ممکن نیست (dev server در فضای ایزوله پیش‌نمایش؛ Caddy داخلی 502، dev.log زنده و GET / 200). جایگزین: lint + tsc + بررسی ایمپورت/تصاویر
