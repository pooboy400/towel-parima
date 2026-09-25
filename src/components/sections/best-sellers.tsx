import { SectionHeading } from "./section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import { getBestSellers } from "@/services/product-service";

/**
 * Best Sellers — پرامپت 27: «محبوب‌ترین انتخاب‌ها»
 */
export async function BestSellersSection() {
  const bestSellers = await getBestSellers(4);

  return (
    <section aria-labelledby="bestsellers-title" className="bg-surface py-14 lg:py-20">
      <div className="container-brand">
        <SectionHeading
          overline="انتخاب مشتریان"
          title="محبوب‌ترین‌ها"
          description="محصولاتی که بالاترین امتیاز را از نظر و تجربهٔ مشتریان گرفته‌اند."
          linkHref="/shop?sort=popular"
          linkLabel="مشاهده همه"
        />
        <ProductGrid products={bestSellers} className="mt-8" />
      </div>
    </section>
  );
}
