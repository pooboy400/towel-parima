// ISR — بازتولید دوره‌ای در سرور (فاز ۲: همگام با بک‌اند)
export const revalidate = 3600;

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { SectionHeading } from "@/components/sections/section-heading";
import { getCollections } from "@/services/category-service";

export const metadata = {
  title: "کالکشن‌ها",
  description:
    "کالکشن‌های پریما؛ پریمیوم، روزمره، اسپا، هدیه و فصلی — انتخاب آماده برای هر حال‌وهوا.",
  alternates: { canonical: "/collections" },
};

/**
 * Collections Index — پرامپت 20
 */
export default async function CollectionsPage() {
  const collections = await getCollections();

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "کالکشن‌ها" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="text-2xl font-bold sm:text-3xl">کالکشن‌های پریما</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          هر کالکشن، یک حال‌وهواست؛ از انتخاب‌های پریمیوم و اسپای تا ست‌های
          هدیه و رنگ‌های فصلی. برای شروع، با یکی از آن‌ها آشنا شو.
        </p>
      </header>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => (
          <Link
            key={c.slug}
            href={`/collections/${c.slug}`}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg"
          >
            <Image
              src={c.image}
              alt={`کالکشن ${c.name}`}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-deep/75 via-deep/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
              <h2 className="text-lg font-semibold">{c.name}</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-cream/85">
                {c.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <SectionHeading
        title="دسته‌بندی‌های فروشگاه"
        description="اگر دنبال محصول خاصی هستی، از دسته‌بندی‌ها شروع کن."
        linkHref="/shop"
        linkLabel="مشاهده همه محصولات"
        className="mt-16"
      />
    </div>
  );
}
