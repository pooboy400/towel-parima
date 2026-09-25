/**
 * Product Repository — تنها نقطه دسترسی DB برای کاتالوگ (بخش ۳ و ۷ سند)
 * ---------------------------------------------------------------
 * ورودی: فیلترهای دامنه · خروجی: Domain Model
 * هیچ Service/UI دیگری @prisma/client را import نمی‌کند.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Product, ProductFilters, SortOption } from "@/domain/models";
import { normalizePersian } from "@/domain/text/normalize-fa";
import {
  buildTsQueryString,
  mapProductToDomain,
  mapReviewToDomain,
  type PrismaProductLike,
} from "./mappers";
import { attachAutoBadges } from "@/core/commerce/badge-service";

/** include استاندارد محصول — همه چیزهایی که نگاشت به مدل خواندن نیاز دارد */
const productInclude = {
  variants: {
    where: { isActive: true, deletedAt: null },
    // ترتیب قطعی: sortOrder (واریانت اصلی اول) سپس id
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { color: true, size: true },
  },
  images: { orderBy: [{ sortOrder: "asc" as const }] },
  collections: { include: { collection: true } },
  category: true,
} satisfies Prisma.ProductInclude;

function applySortInMemory(items: Product[], sort?: SortOption): Product[] {
  const sorted = [...items];
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

export const productRepository = {
  /**
   * جستجوی متنی دیتابیسی (بخش ۱۷ سند): FTS با prefix + fallback substring.
   * ورودی با همان normalizePersian ایندکس می‌شود (index-time = query-time).
   * خروجی: شناسه‌های منطبق — برای ترکیب با where ساختاری.
   */
  async searchIds(query: string): Promise<string[] | null> {
    const q = normalizePersian(query.trim()).toLowerCase();
    if (!q) return null; // بدون شرط متنی
    const tsq = buildTsQueryString(q);
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Product"
      WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL
        AND (
          "searchKey" ILIKE ${"%" + escaped + "%"} ESCAPE '\\'
          ${
            tsq
              ? Prisma.sql`OR to_tsvector('simple', "searchKey") @@ to_tsquery('simple', ${tsq})`
              : Prisma.empty
          }
        )
        LIMIT 500
    `);
    return rows.map((r) => r.id);
  },

  /** فیلتر ترکیبی فروشگاه — فیلترهای دیتابیسی + فیلترهای محاسباتی در حافظه */
  async findActive(filters: ProductFilters = {}): Promise<{
    items: Product[];
    total: number;
  }> {
    // جستجوی متنی: پیش‌فیلتر در DB با FTS/substring (بخش ۱۷)
    let textIds: string[] | null = null;
    if (filters.query?.trim()) {
      textIds = await this.searchIds(filters.query);
      if (textIds && textIds.length === 0) {
        return { items: [], total: 0 };
      }
    }

    const where = {
      status: "ACTIVE" as const,
      deletedAt: null,
      ...(textIds ? { id: { in: textIds } } : {}),
      ...(filters.category ? { category: { slug: filters.category } } : {}),
      ...(filters.collection
        ? { collections: { some: { collection: { slug: filters.collection } } } }
        : {}),
      ...(filters.colors?.length
        ? { variants: { some: { colorId: { in: filters.colors } } } }
        : {}),
      ...(filters.sizes?.length
        ? { variants: { some: { sizeId: { in: filters.sizes } } } }
        : {}),
      ...(filters.onlyAvailable ? { variants: { some: { stock: { gt: 0 } } } } : {}),
    };

    // کوئری DB برای فیلترهای ساختاری؛ فیلترهای محاسباتی (قیمت تجمیعی، امتیاز)
    // روی نتیجه نگاشت‌شده — مقیاس کاتالوگ چندصدتایی OK
    const rows = (await db.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ sortOrder: "asc" }],
    })) as unknown as PrismaProductLike[];

    let products = await attachAutoBadges(rows.map(mapProductToDomain));

    if (filters.priceFrom !== undefined) {
      products = products.filter((p) => p.price >= filters.priceFrom!);
    }
    if (filters.priceTo !== undefined) {
      products = products.filter((p) => p.price <= filters.priceTo!);
    }
    if (filters.minRating !== undefined) {
      products = products.filter((p) => p.rating >= filters.minRating!);
    }

    return { items: applySortInMemory(products, filters.sort), total: products.length };
  },

  async findBySlug(slug: string): Promise<Product | null> {
    const row = (await db.product.findFirst({
      where: { slug, status: "ACTIVE", deletedAt: null },
      include: productInclude,
    })) as unknown as PrismaProductLike | null;
    if (!row) return null;
    const [product] = await attachAutoBadges([mapProductToDomain(row)]);
    return product ?? null;
  },

  async findManyBySlugs(slugs: string[]): Promise<Product[]> {
    if (slugs.length === 0) return [];
    const rows = (await db.product.findMany({
      where: { slug: { in: slugs }, deletedAt: null },
      include: productInclude,
    })) as unknown as PrismaProductLike[];
    const items = await attachAutoBadges(rows.map(mapProductToDomain));
    const bySlug = new Map(items.map((p) => [p.slug, p]));
    return slugs
      .map((s) => bySlug.get(s))
      .filter((p): p is Product => Boolean(p));
  },

  /** پرفروش‌ترین‌ها — مرتب‌سازی بر اساس وزن امتیاز (reviewCount×rating) */
  async bestSellers(limit = 4): Promise<Product[]> {
    const rows = (await db.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: productInclude,
    })) as unknown as PrismaProductLike[];
    return attachAutoBadges(
      rows
        .map(mapProductToDomain)
        .sort((a, b) => b.reviewCount * b.rating - a.reviewCount * a.rating)
        .slice(0, limit),
    );
  },

  async newArrivals(limit = 4): Promise<Product[]> {
    const rows = (await db.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: productInclude,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
    })) as unknown as PrismaProductLike[];
    return attachAutoBadges(rows.map(mapProductToDomain));
  },

  /** مرتبط‌ها: اول هم‌دسته، بعد هم‌کالکشن (پرامپت ۴۰) */
  async related(product: Product, limit = 4): Promise<Product[]> {
    const rows = (await db.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        id: { not: product.id },
        OR: [
          { category: { slug: product.categorySlug } },
          {
            collections: {
              some: { collection: { slug: { in: product.collectionSlugs } } },
            },
          },
        ],
      },
      include: productInclude,
    })) as unknown as PrismaProductLike[];

    const items = await attachAutoBadges(rows.map(mapProductToDomain));
    const sameCategory = items.filter((p) => p.categorySlug === product.categorySlug);
    const sameCollection = items.filter(
      (p) =>
        p.categorySlug !== product.categorySlug &&
        p.collectionSlugs.some((c) => product.collectionSlugs.includes(c)),
    );
    return [...sameCategory, ...sameCollection].slice(0, limit);
  },

  /** برای generateStaticParams */
  async allSlugs(): Promise<string[]> {
    const rows = await db.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { slug: true },
      orderBy: [{ sortOrder: "asc" }],
    });
    return rows.map((r) => r.slug);
  },

  /** نظرات منتشرشده یک محصول */
  async reviewsBySlug(slug: string) {
    const rows = await db.review.findMany({
      where: {
        product: { slug },
        status: "APPROVED",
        publishedAt: { not: null },
      },
      include: { product: { select: { slug: true } } },
      orderBy: [{ publishedAt: "desc" }],
    });
    return rows.map(mapReviewToDomain);
  },

  /** رنگ‌های مرجع برای فیلتر فروشگاه — از جدول Color، نه آرایهٔ ثابت کد */
  async listColors(): Promise<{ id: string; name: string; hex: string }[]> {
    return db.color.findMany({
      select: { id: true, name: true, hex: true },
      orderBy: [{ id: "asc" }],
    });
  },

  /** سایزهای مرجع برای فیلتر فروشگاه — از جدول Size با ترتیب رسمی */
  async listSizes(): Promise<
    { id: string; name: string; dimensions: string | null }[]
  > {
    return db.size.findMany({
      select: { id: true, name: true, dimensions: true },
      orderBy: [{ sortOrder: "asc" }],
    });
  },
};
