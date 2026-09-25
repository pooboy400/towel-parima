import { getProducts, getFilterFacets } from "@/services/product-service";
import { getCategories } from "@/services/category-service";
import type { ProductFilters, SortOption } from "@/types";
import { ShopView } from "./shop-view";

/**
 * /shop — صفحه فروشگاه با فیلتر از URL (SSR-friendly و قابل اشتراک)
 */
export const metadata = {
  title: "فروشگاه حوله",
  description:
    "همه محصولات پریما؛ حوله حمام، دست و صورت، استخری، تن‌پوش، کودک و ست‌ها با فیلتر رنگ، سایز و قیمت.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function multi(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  const raw = Array.isArray(v) ? v.join(",") : v;
  const list = raw.split(",").filter(Boolean);
  return list.length ? list : undefined;
}

function num(v: string | string[] | undefined): number | undefined {
  const s = single(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const filters: ProductFilters = {
    colors: multi(sp.color),
    sizes: multi(sp.size),
    priceFrom: num(sp.priceFrom),
    priceTo: num(sp.priceTo),
    minRating: num(sp.rating),
    onlyAvailable: single(sp.available) === "1",
    sort: (single(sp.sort) as SortOption) ?? undefined,
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
      activeCategory={null}
      filters={filters}
      searchQuery={filters.query}
      facets={facets}
    />
  );
}
