/**
 * Mappers — نگاشت Prisma Model → Domain Model (بخش ۳ سند معماری)
 * ---------------------------------------------------------------
 * توابع pure و تست‌پذیر؛ هیچ وابستگی به دیتابیس یا Network ندارند.
 * UI و Service فقط خروجی این نگاشت‌ها (Domain Model) را می‌بینند.
 */
import type {
  BadgeType,
  Category,
  Collection,
  ColorOption,
  Product,
  ProductSpec,
  ProductSize,
  Review,
  JournalPost,
  Variant,
} from "@/domain/models";
import { normalizePersian } from "@/domain/text/normalize-fa";

/* ------------------------------------------------------------------ */
/* تعریف شکل ورودی Prisma — بدون import از @prisma/client              */
/* (ساختار ساختاری؛ Repository آبجکت‌ها را از کوئری Prisma می‌گیرد)      */
/* ------------------------------------------------------------------ */

export interface PrismaColorLike {
  id: string;
  name: string;
  hex: string;
}

export interface PrismaSizeLike {
  id: string;
  name: string;
  sortOrder: number;
  dimensions: string | null;
  gsm: number | null;
}

export interface PrismaVariantLike {
  id: string;
  productId: string;
  colorId: string | null;
  sizeId: string | null;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  reserved: number;
  isActive: boolean;
  deletedAt: Date | null;
  color?: PrismaColorLike | null;
  size?: PrismaSizeLike | null;
}

export interface PrismaProductImageLike {
  id: string;
  productId: string;
  storageKey: string;
  alt: string | null;
  sortOrder: number;
}

export interface PrismaCategoryLike {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageKey: string | null;
  sortOrder: number;
  deletedAt: Date | null;
  seoText: string | null;
}

export interface PrismaCollectionLike {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageKey: string | null;
  sortOrder: number;
  deletedAt: Date | null;
}

export interface PrismaProductLike {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryId: string;
  deletedAt: Date | null;
  createdAt: Date;
  specs: unknown;
  care: string[];
  suitableFor: string[];
  features: string[];
  rating: number;
  reviewCount: number;
  sortOrder: number;
  variants: PrismaVariantLike[];
  images: PrismaProductImageLike[];
  collections: { collection: PrismaCollectionLike }[];
  category: PrismaCategoryLike;
}

/* ------------------------------------------------------------------ */
/* مپرهای ساده                                                         */
/* ------------------------------------------------------------------ */

export function mapCategoryToDomain(c: PrismaCategoryLike): Category {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    seoText: c.seoText ?? undefined,
    image: c.imageKey ?? "",
  };
}

export function mapCollectionToDomain(c: PrismaCollectionLike): Collection {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    image: c.imageKey ?? "",
  };
}

export function mapVariantToDomain(v: PrismaVariantLike): Variant {
  return {
    id: v.id,
    productId: v.productId,
    colorId: v.colorId ?? undefined,
    sizeId: v.sizeId ?? undefined,
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? undefined,
    stock: v.stock,
    reserved: v.reserved,
    isActive: v.isActive,
    deletedAt: v.deletedAt?.toISOString() ?? null,
  };
}

export function mapReviewToDomain(r: {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  publishedAt: Date | null;
  verifiedPurchase: boolean;
  product: { slug: string };
}): Review {
  return {
    id: r.id,
    productSlug: r.product.slug,
    userName: r.authorName,
    rating: r.rating,
    date: (r.publishedAt ?? new Date(0)).toISOString().slice(0, 10),
    comment: r.body,
    verifiedPurchase: r.verifiedPurchase,
  };
}

/* ------------------------------------------------------------------ */
/* نگاشت محصول — تجمیع Product+Variant به مدل خواندن فاز ۱             */
/* ------------------------------------------------------------------ */

export function mapProductToDomain(p: PrismaProductLike): Product {
  // واریانت‌های فعالِ حذف‌نشده — واحد قیمت و موجودی
  const variants = p.variants.filter((v) => v.isActive && !v.deletedAt);
  // BUG-05 (فاز ۲ — ADR 011 «UI هرگز جعل نمی‌کند»): fallback قبلی به همهٔ
  // واریانت‌ها باعث می‌شد محصولی که واریانت دارد ولی همه غیرفعال‌اند، موجودیِ
  // نمایشی مثبت بگیرد (۸) در حالی که رزرو با INACTIVE رد می‌شود — وعدهٔ کاذب.
  // الان: فقط واریانت‌های فعال ملاک‌اند؛ محصولِ واقعاً بی‌واریانت هم طبیعتاً
  // آرایهٔ خالی می‌گیرد (رفتار قبلی حفظ است) و موجودی نمایشی ۰ می‌شود.
  const activeVariants = variants;

  // قیمت: حداقل قیمت واریانت‌ها (همان قیمت mock — همه واریانت‌ها هم‌قیمت seed شدند)
  const price = activeVariants.reduce(
    (min, v) => (v.price < min ? v.price : min),
    activeVariants[0]?.price ?? 0,
  );
  // compareAtPrice از واریانت اول — BUG-16 (فاز ۳) ADR: در واریانت ناهم‌قیمت
  // درصد تخفیف کارت ممکن است بیش‌نمایی شود؛ دیتای فعلی هم‌قیمت است و تصمیم
  // نهایی (min compareAt یا گارد فرم ادمین) برای فاز ۴ ثبت شد — قبل از آن
  // ادمین نباید واریانت‌های یک محصول را ناهم‌قیمت کند.
  const compareAtPrice = activeVariants[0]?.compareAtPrice ?? undefined;
  // sku: واریانت اصلی (اولین) — همان sku mock
  const sku = activeVariants[0]?.sku ?? "";
  // موجودی قابل فروش: Σ(stock − reserved) (بخش ۱۳ سند)
  const stock = activeVariants.reduce(
    (sum, v) => sum + Math.max(0, v.stock - v.reserved),
    0,
  );

  // رنگ‌ها و سایزهای متمایز واریانت‌ها — با حفظ ترتیب ورود
  const colorMap = new Map<string, ColorOption>();
  const sizeMap = new Map<string, ProductSize>();
  for (const v of activeVariants) {
    if (v.color && !colorMap.has(v.color.id)) {
      colorMap.set(v.color.id, { id: v.color.id, name: v.color.name, hex: v.color.hex });
    }
    if (v.size && !sizeMap.has(v.size.id)) {
      sizeMap.set(v.size.id, {
        id: v.size.id,
        label: v.size.name,
        dimensions: v.size.dimensions ?? "",
        gsm: v.size.gsm ?? undefined,
      });
    }
  }

  const images = [...p.images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => i.storageKey);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    price,
    compareAtPrice: compareAtPrice ?? undefined,
    sku,
    categorySlug: p.category.slug,
    collectionSlugs: p.collections.map((cp) => cp.collection.slug),
    images,
    colors: [...colorMap.values()],
    sizes: [...sizeMap.values()],
    specs: Array.isArray(p.specs) ? (p.specs as ProductSpec[]) : [],
    care: p.care,
    suitableFor: p.suitableFor,
    features: p.features,
    stock,
    status: p.status,
    rating: p.rating,
    reviewCount: p.reviewCount,
    // برچسب‌ها محاسباتی‌اند (ADR 011) — Repository با attachAutoBadges پر می‌کند
    badges: [],
    order: p.sortOrder,
    createdAt: p.createdAt.toISOString().slice(0, 10),
  };
}

/* ------------------------------------------------------------------ */
/* ژورنال                                                              */
/* ------------------------------------------------------------------ */

export function mapJournalToDomain(j: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  coverKey: string | null;
  topic: string;
  readingMinutes: number;
  publishedAt: Date | null;
}): JournalPost {
  return {
    id: j.id,
    slug: j.slug,
    title: j.title,
    excerpt: j.excerpt,
    content: j.bodyMarkdown.split(/\n{2,}/).filter(Boolean),
    image: j.coverKey ?? "",
    category: j.topic,
    date: (j.publishedAt ?? new Date(0)).toISOString().slice(0, 10),
    readingTime: j.readingMinutes,
  };
}

/* ------------------------------------------------------------------ */
/* جستجوی فارسی (بخش ۱۷ سند) — index-time و query-time از همین توابع    */
/* ------------------------------------------------------------------ */

/**
 * کلید جستجوی ایندکسی: متن نرمال‌شده (با فاصله) برای FTS + substring.
 * categorySlug هم appended می‌شود تا رفتار جستجوی فاز ۱ (تطبیق slug) حفظ شود.
 */
export function buildProductSearchKey(
  name: string,
  shortDescription: string,
  description: string,
  categorySlug: string,
): string {
  return normalizePersian(
    `${name} ${shortDescription} ${description} ${categorySlug}`,
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ساخت tsquery امن با پسوند prefix برای config ساده.
 * فقط حروف/ارقام مجاز — ورودی قبلاً با normalizePersian تمیز شده.
 * OR بین توکن‌ها + prefix matching: «حوله ح» → (حوله:* | ح:*)
 */
export function buildTsQueryString(normalizedQuery: string): string | null {
  const tokens = normalizedQuery
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length > 0)
    .slice(0, 8); // سقف توکن — جلوگیری از کوئری‌های عجیب
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${t}:*`).join(" | ");
}
