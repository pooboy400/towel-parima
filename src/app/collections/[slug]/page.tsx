// ISR — بازتولید دوره‌ای در سرور (فاز ۲: همگام با بک‌اند)
export const revalidate = 3600;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts } from "@/services/product-service";
import {
  getCategories,
  getCollectionBySlug,
  getCollections,
} from "@/services/category-service";
import type { ProductFilters } from "@/types";
import { ShopView } from "@/app/shop/shop-view";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const collections = await getCollections();
  return collections.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "کالکشن پیدا نشد" };
  return {
    title: `کالکشن ${collection.name}`,
    description: collection.description,
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const filters: ProductFilters = { collection: collection.slug };
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(filters),
  ]);

  return (
    <ShopView
      products={products.items}
      total={products.total}
      categories={categories}
      activeCategory={null}
      filters={filters}
      titleOverride={`کالکشن ${collection.name}`}
      descriptionOverride={collection.description}
    />
  );
}
