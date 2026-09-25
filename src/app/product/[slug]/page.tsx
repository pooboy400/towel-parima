// ISR — بازتولید دوره‌ای صفحه محصول در سرور؛ در فاز ۲ با تغییر موجودی/قیمت در بک‌اند، صفحه تازه می‌شود
export const revalidate = 3600;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductGallery } from "./gallery";
import { ProductInfo } from "./product-info";
import { ProductTabs } from "./product-tabs";
import { getProductBySlug, getProducts, getProductReviews, getRelatedProducts, getAllProductSlugs } from "@/services/product-service";
import { getCategoryBySlug } from "@/services/category-service";
import { getAllJournalSlugs } from "@/services/content-service";
import { getStoreSettingsSafe } from "@/services/settings-service";
import { JsonLd, productSchema, breadcrumbSchema } from "@/components/seo/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://prima-towel.ir";

type Params = Promise<{ slug: string }>;

/** SSG — همه صفحات محصول در بیلد استاتیک ساخته می‌شوند */
export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  // notFound در metadata: رندر قبل از فلاش‌شدن shell قطع می‌شود تا HTTP status صحیح 404 برگردد
  // (رفع باگ ISR: صفحه محصول برای slug ناموجود 200 برمی‌گرداند — journal/collections سالم بودند)
  if (!product) notFound();
  return {
    title: product.name,
    description: product.shortDescription,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      images: [{ url: product.images[0] }],
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [category, reviews, related, settings, journalSlugs] = await Promise.all([
    getCategoryBySlug(product.categorySlug),
    getProductReviews(product.slug),
    getRelatedProducts(product, 4),
    getStoreSettingsSafe(),
    getAllJournalSlugs().catch(() => [] as string[]),
  ]);

  // لینک راهنمای سایز — داینامیک: اگر مقالهٔ راهنما حذف/تغییرنام شد → ژورنال
  const SIZE_GUIDE_SLUG = "how-to-choose-a-towel";
  const sizeGuideHref = journalSlugs.includes(SIZE_GUIDE_SLUG)
    ? `/journal/${SIZE_GUIDE_SLUG}`
    : "/journal";

  return (
    <div className="container-brand py-8 lg:py-10">
      {/* Breadcrumb — پرامپت 94 */}
      <Breadcrumb
        items={[
          { label: "خانه", href: "/" },
          { label: "فروشگاه", href: "/shop" },
          ...(category
            ? [
                { label: category.name, href: `/shop/${category.slug}` },
              ]
            : []),
          { label: product.name },
        ]}
      />

      <JsonLd
        data={
          productSchema(SITE_URL, {
            name: product.name,
            slug: product.slug,
            description: product.shortDescription,
            images: product.images,
            price: product.price,
            stock: product.stock,
            rating: product.rating,
            reviewCount: product.reviewCount,
          })
        }
      />
      <JsonLd
        data={
          breadcrumbSchema(SITE_URL, [
            { name: "خانه", url: "/" },
            { name: "فروشگاه", url: "/shop" },
            ...(category
              ? [{ name: category.name, url: `/shop/${category.slug}` }]
              : []),
            { name: product.name, url: `/product/${product.slug}` },
          ])
        }
      />

      {/* Layout دسکتاپ: گالری + اطلاعات — پرامپت 30 */}
      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />
        <ProductInfo
          product={product}
          shipping={settings.shipping}
          freeShippingThreshold={settings.config.freeShippingThreshold}
          sizeGuideHref={sizeGuideHref}
        />
      </div>

      {/* توضیح کامل + مناسب برای */}
      <section aria-labelledby="desc-title" className="mt-14 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 id="desc-title" className="text-xl font-bold">
            درباره این محصول
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-9 text-muted-foreground">
            {product.description}
          </p>
        </div>

        {/* پرامپت 129: این محصول مناسب شماست اگر… */}
        <aside className="h-fit rounded-lg border border-line bg-surface p-6">
          <h3 className="text-[15px] font-semibold">این محصول مناسب شماست اگر…</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {product.suitableFor.map((s) => (
              <li key={s} className="flex gap-2.5 text-[13px] leading-6 text-muted-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-terracotta" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </aside>
      </section>

      {/* Tabs — مشخصات / نگهداری / نظرات */}
      <ProductTabs product={product} reviews={reviews} />

      {/* محصولات مرتبط — پرامپت 40 */}
      {related.length > 0 && (
        <section aria-labelledby="related-title" className="mt-16 border-t border-line pt-12">
          <div className="flex items-center justify-between">
            <h2 id="related-title" className="text-xl font-bold">
              شاید این‌ها را هم دوست داشته باشید
            </h2>
            {category && (
              <Link
                href={`/shop/${category.slug}`}
                className="text-sm text-terracotta-deep hover:underline"
              >
                مشاهده {category.name}
              </Link>
            )}
          </div>
          <ProductGrid products={related} className="mt-7" />
        </section>
      )}
    </div>
  );
}
