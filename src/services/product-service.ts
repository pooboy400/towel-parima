/**
 * Product Service — پرامپت 145: Business operations جدا از UI
 * ---------------------------------------------------------------
 * M1: پیاده‌سازی روی PostgreSQL از طریق ProductRepository — امضاها عین فاز ۱.
 * UI فقط این توابع را صدا می‌زند؛ هیچ کامپوننتی تغییر نکرده است.
 */
import "server-only";
import type { Product, ProductFilters, Review, SortOption } from "@/domain/models";
import { CACHE_TAGS } from "@/core/cache";
import { cachedRead } from "@/lib/cache";
import { productRepository } from "@/lib/repositories/product-repository";

export interface ProductsResult {
  items: Product[];
  total: number;
}

function applySort(list: Product[], sort?: SortOption): Product[] {
  const sorted = [...list];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "rating":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "newest":
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "popular":
    default:
      return sorted.sort(
        (a, b) => b.reviewCount * b.rating - a.reviewCount * a.rating,
      );
  }
}

export async function getProducts(
  filters: ProductFilters = {},
): Promise<ProductsResult> {
  return productRepository.findActive(filters);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return productRepository.findBySlug(slug);
}

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  return productRepository.findManyBySlugs(slugs);
}

export async function getBestSellers(limit = 4): Promise<Product[]> {
  // بخش‌های صفحه اصلی — tagهای products + homepage برای invalidation ادمین M2
  return cachedRead(
    () => productRepository.bestSellers(limit),
    ["best-sellers-v1", String(limit)],
    [CACHE_TAGS.products, CACHE_TAGS.homepage],
  );
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  return cachedRead(
    () => productRepository.newArrivals(limit),
    ["new-arrivals-v1", String(limit)],
    [CACHE_TAGS.products, CACHE_TAGS.homepage],
  ).then((items) => applySort(items, "newest"));
}

/** محصولات مرتبط — واقعاً مرتبط: اول هم‌دسته، بعد هم‌کالکشن (پرامپت 40) */
export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  return productRepository.related(product, limit);
}

/** برای generateStaticParams در فاز SSG */
export async function getAllProductSlugs(): Promise<string[]> {
  return productRepository.allSlugs();
}

export async function getProductReviews(slug: string): Promise<Review[]> {
  return productRepository.reviewsBySlug(slug);
}

/** ---------- Facetهای فیلتر فروشگاه — از جدول‌های مرجع Color/Size ---------- */

export interface FilterFacets {
  colors: { id: string; name: string; hex: string }[];
  sizes: { id: string; label: string }[];
}

/**
 * رنگ‌ها/سایزهای فیلتر فروشگاه مستقیم از دیتابیس می‌آید تا با کاتالوگ هم‌گام
 * بماند (رنگ/سایز تازه‌ای که ادمین اضافه می‌کند بلافاصله در فیلتر دیده می‌شود).
 */
export async function getFilterFacets(): Promise<FilterFacets> {
  const [colors, sizes] = await Promise.all([
    productRepository.listColors(),
    productRepository.listSizes(),
  ]);
  return {
    colors,
    sizes: sizes.map((s) => ({
      id: s.id,
      label: s.dimensions ? `${s.name} (${s.dimensions})` : s.name,
    })),
  };
}
