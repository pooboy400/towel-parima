import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts, getFilterFacets } from "@/services/product-service";
import {
  getCategories,
  getCategoryBySlug,
} from "@/services/category-service";
import type { ProductFilters } from "@/types";
import { ShopView } from "../shop-view";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function multi(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  const list = (Array.isArray(v) ? v.join(",") : v)
    .split(",")
    .filter(Boolean);
  return list.length ? list : undefined;
}

function num(v: string | string[] | undefined): number | undefined {
  const s = single(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** SSG — پرامپت: سایت SSG/SSR؛ دسته‌ها در بیلد استاتیک ساخته می‌شوند */
export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "دسته پیدا نشد" };
  return {
    title: `${category.name} — خرید با کیفیت پریما`,
    description: category.description,
    alternates: { canonical: `/shop/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: SearchParams;
}) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const sp = await searchParams;
  const filters: ProductFilters = {
    category: category.slug,
    colors: multi(sp.color),
    sizes: multi(sp.size),
    priceFrom: num(sp.priceFrom),
    priceTo: num(sp.priceTo),
    minRating: num(sp.rating),
    onlyAvailable: single(sp.available) === "1",
    query: single(sp.query),
  };

  const [categories, products, facets] = await Promise.all([
    getCategories(),
    getProducts(filters),
    getFilterFacets().catch(() => undefined),
  ]);

  return (
    <ShopView
      products={products.items}
      total={products.total}
      categories={categories}
      activeCategory={category}
      filters={filters}
      seoText={category.seoText}
      facets={facets}
    />
  );
}
