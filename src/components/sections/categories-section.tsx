import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "./section-heading";
import { getCategories } from "@/services/category-service";

/**
 * Categories — پرامپت 26: «برای هر لحظه، یک انتخاب»
 * گرید ادیتوریال: ۶ کارت، دوتای اول بزرگ‌تر
 */
export async function CategoriesSection() {
  const categories = await getCategories();

  return (
    <section aria-labelledby="categories-title" className="py-14 lg:py-20">
      <div className="container-brand">
        <SectionHeading
          overline="دسته‌بندی‌ها"
          title="برای هر لحظه، یک انتخاب"
          description="از حوله حمام روزمره تا ست‌های هدیه؛ هر دسته با همان وسواس کیفیت بافته شده است."
          linkHref="/shop"
          linkLabel="همه محصولات"
        />

        <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {/* کارت بزرگ اول */}
          {categories.slice(0, 2).map((c) => (
            <Link
              key={c.slug}
              href={`/shop/${c.slug}`}
              className="group relative col-span-2 aspect-[16/10] overflow-hidden rounded-lg lg:col-span-2"
            >
              <Image
                src={c.image}
                alt={c.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-deep/70 via-deep/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                <div className="text-cream">
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                  <p className="mt-1 max-w-[26ch] text-xs leading-6 text-cream/85">
                    {c.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}

          {/* کارت‌های کوچک */}
          {categories.slice(2).map((c) => (
            <Link
              key={c.slug}
              href={`/shop/${c.slug}`}
              className="group relative aspect-square overflow-hidden rounded-lg"
            >
              <Image
                src={c.image}
                alt={c.name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-deep/70 via-deep/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-cream">
                <h3 className="text-[15px] font-semibold">{c.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
