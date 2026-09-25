import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getProducts } from "@/services/product-service";
import { getCollectionBySlug } from "@/services/category-service";
import { getHomeSettings } from "@/services/settings-service";
import { DEFAULT_FEATURED_COLLECTION_SLUG } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { Rating } from "@/components/product/rating";

/**
 * Featured Collection — بنر لایف‌استایل + سه محصول کالکشن ویژه
 * کالکشنِ انتخابی از Setting «home.featured» می‌آید (ادمین از /admin/settings عوض می‌کند)
 * — دیگر اسلاگ ثابت "spa" در کد نیست.
 */
export async function FeaturedCollectionSection() {
  const { featuredCollectionSlug: slug, headline } = await getHomeSettings().catch(() => ({
    featuredCollectionSlug: DEFAULT_FEATURED_COLLECTION_SLUG,
    headline: "حس اسپا، در خانه خودتان",
  }));

  const [collection, products] = await Promise.all([
    getCollectionBySlug(slug),
    getProducts({ collection: slug }),
  ]);
  const { items } = products;

  return (
    <section aria-labelledby="featured-title" className="bg-deep py-14 text-cream lg:py-20">
      <div className="container-brand">
        <div className="grid items-center gap-10 lg:grid-cols-5 lg:gap-14">
          {/* متن + محصولات */}
          <div className="flex flex-col gap-7 lg:col-span-3">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium tracking-wide text-sand">
                {collection?.name ?? "کالکشن ویژه"}
              </span>
              <h2 id="featured-title" className="text-2xl font-bold sm:text-[30px]">
                {headline}
              </h2>
              <p className="max-w-md text-[15px] leading-8 text-cream/70">
                {collection?.description ??
                  "بافت‌های لطیف و رنگ‌های آرام برای ریکاوری روزانه."}
              </p>
            </div>

            <ul className="flex flex-col divide-y divide-cream/10">
              {items.slice(0, 3).map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/product/${product.slug}`}
                    className="group flex items-center gap-4 py-3.5"
                  >
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-md">
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-medium group-hover:text-sand">
                        {product.name}
                      </span>
                      <Rating
                        value={product.rating}
                        className="[&_span]:text-cream/60 [&_svg]:text-cream/40"
                      />
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-sand">
                      {formatPrice(product.price)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div>
              <Button
                variant="outline"
                asChild
                className="border-cream/25 bg-transparent text-cream hover:bg-cream/10 hover:text-cream"
              >
                <Link href={`/collections/${slug}`}>
                  مشاهده {collection?.name ?? "کالکشن ویژه"}
                </Link>
              </Button>
            </div>
          </div>

          {/* تصویر */}
          <div className="relative lg:col-span-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg">
              <Image
                src="/images/lifestyle-candle.jpg"
                alt="حوله‌های لطیف کنار وان حمام با شمع و نور گرم"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
