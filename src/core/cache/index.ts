/**
 * Cache Tags — tagهای کانونی entity-aware (بخش ۱۶.۱ سند معماری)
 * ---------------------------------------------------------------
 * قانون: هر mutation فقط tagهای مرتبط را invalidate می‌کند.
 * این فایل تنها مرجع رشته تگ‌هاست — رشته تگ در کد business ممنوع.
 */

export const CACHE_TAGS = {
  product: (id: string) => `product:${id}`,
  products: "products",
  category: (slug: string) => `category:${slug}`,
  collection: (slug: string) => `collection:${slug}`,
  homepage: "homepage",
  journal: "journal",
  journalPost: (slug: string) => `journal:${slug}`,
  settings: "settings",
  reviews: (productId: string) => `reviews:${productId}`,
  /** محتوای عمومی غیر از ژورنال (FAQ و…) — توسعه M1 روی مجموعه کانونی سند */
  content: "content",
} as const;

/**
 * invalidation استاندارد تغییر محصول — گروه تگ‌های مرتبط را یکجا برمی‌گرداند
 * تا فراخواننده فراموش نکند (صفحه اصلی اگر محصول در بخش‌هایش است).
 */
export function productInvalidationTags(
  productId: string,
  opts: { categorySlug?: string; onHomepage?: boolean; collections?: readonly string[] } = {},
): string[] {
  const tags = [
    CACHE_TAGS.product(productId),
    CACHE_TAGS.products,
    ...(opts.categorySlug ? [CACHE_TAGS.category(opts.categorySlug)] : []),
    ...(opts.collections?.map((c) => CACHE_TAGS.collection(c)) ?? []),
    ...(opts.onHomepage ? [CACHE_TAGS.homepage] : []),
  ];
  return [...new Set(tags)];
}

/**
 * invalidation فوری یک تگ — با امضای Next 16 (پروفایل expire: 0 = بی‌درنگ).
 * تنها نقطه مجاز صدا زدن revalidateTag در کد ادمین — رشته تگ خام هرگز اینجا
 * از این فایل بیرون نمی‌رود (قرارداد بخش ۱۶.۱).
 */
export function revalidateEntityTag(tag: string): void {
  // import دینامیک برای جلوگیری از وابستگی سراسری next/cache در تست‌های unit
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { revalidateTag } = require("next/cache") as typeof import("next/cache");
  try {
    revalidateTag(tag, { expire: 0 });
  } catch (err) {
    // Next 16: revalidateTag فقط در زمینهٔ درخواست/رندر کار می‌کند (static
    // generation store). در زمینه‌های بیرون از درخواست — worker تایمر انقضای
    // رزرو یا اسکریپت‌های تست — رد می‌شود تا جریان اصلی نشکند؛ صفحات ISR در
    // پنجرهٔ revalidate خودشان تازه می‌شوند. (ADR 011 — best-effort invalidation)
    if (err instanceof Error && err.message.includes("static generation store")) {
      console.info(
        JSON.stringify({
          level: "info",
          scope: "cache",
          msg: `revalidateTag خارج از زمینهٔ درخواست رد شد: ${tag}`,
        }),
      );
      return;
    }
    throw err;
  }
}
