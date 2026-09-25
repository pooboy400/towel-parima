/**
 * Format Utils — پرامپت 113: اعداد، قیمت و تاریخ باید فارسی و درست نمایش داده شوند.
 */

const faNumber = new Intl.NumberFormat("fa-IR", { useGrouping: true });

/** 1490000 → «۱٬۴۹۰٬۰۰۰» */
export function formatNumber(value: number): string {
  return faNumber.format(value);
}

/** 1490000 → «۱٬۴۹۰٬۰۰۰ تومان» */
export function formatPrice(value: number, withCurrency = true): string {
  const n = faNumber.format(value);
  return withCurrency ? `${n} تومان` : n;
}

/** درصد تخفیف واقعی — فقط اگر compareAtPrice معتبر باشد */
export function discountPercent(
  price: number,
  compareAtPrice?: number,
): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/** تاریخ ISO → فارسی، مثال: «۱۴ مرداد ۱۴۰۳» */
export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** شماره موبایل/کد را با اعداد فارسی نمایش می‌دهد */
export function faDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** ارقام فارسی/عربی → لاتین — برای href هایی مثل tel: که ارقام لاتین می‌خواهند */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
