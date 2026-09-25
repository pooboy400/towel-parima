/**
 * JSON-LD Structured Data — پرامپت 66 و 110
 * فقط داده واقعی (پرامپت: اگر داده واقعی وجود دارد)
 * data می‌تواند یک اسکیمای تکی یا آرایه‌ای از اسکیماها باشد.
 *
 * امنیت (رفع XSS گزارش 47-c): JSON.stringify به‌تنهایی «</script>» را escape
 * نمی‌کند — اگر فیلدی (مثلاً description محصول) شامل تگ بسته‌شدن اسکریپت باشد،
 * از بلوک script خارج می‌شود و در مرورگر ادمین اجرا می‌شود (content→XSS).
 * توکن‌های خطرناک JSON (< U+2028 U+2029) با escape امن جایگزین می‌شوند —
 * خروجی برای JSON.parse معتبر می‌ماند.
 */
type JsonLdData = Record<string, unknown> | Record<string, unknown>[];

/** escape امن برای درج JSON داخل تگ script — تست‌پذیر */
export function safeJsonForScript(data: JsonLdData): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonForScript(data) }}
    />
  );
}

export function organizationSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "پریما",
    alternateName: "PRIMA",
    url: siteUrl,
    logo: `${siteUrl}/logo.svg`,
    description:
      "فروشگاه آنلاین حوله‌های باکیفیت برای حمام، استخر، هدیه و استفاده روزمره",
  };
}

export function websiteSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "پریما",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/shop?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function productSchema(
  siteUrl: string,
  product: {
    name: string;
    slug: string;
    description: string;
    images: string[];
    price: number;
    stock: number;
    rating: number;
    reviewCount: number;
  },
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((img) => `${siteUrl}${img}`),
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/product/${product.slug}`,
      priceCurrency: "IRT",
      price: product.price,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };
}

export function breadcrumbSchema(
  siteUrl: string,
  items: { name: string; url: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteUrl}${item.url}`,
    })),
  };
}
