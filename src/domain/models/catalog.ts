/**
 * Domain Models — کاتالوگ
 * ---------------------------------------------------------------
 * قراردادهای دامنه انتقال‌یافته از src/types فاز ۱ (بدون تغییر شکل — بخش ۲۶ سند معماری)
 * به‌علاوه قراردادهای v2 کاتالوگ (Variant) برای M1+.
 *
 * قانون معماری (بخش ۳ سند): UI و Service فقط این تایپ‌ها را می‌بینند؛
 * Prisma Model هرگز از این لایه بیرون نمی‌رود.
 */

/* ------------------------------------------------------------------ */
/* قراردادهای فاز ۱ — عیناً حفظ شده تا سوییچ M1 صفر تغییر در UI بدهد   */
/* ------------------------------------------------------------------ */

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

/**
 * برچسب‌های محاسباتی (ADR 011) — هرگز با دست زده نمی‌شوند:
 *   new       → کمتر از newDays روز از افزودن (Setting store.badgeRules)
 *   bestseller → فروش پرداخت‌شدهٔ واقعی ≥ حد در پنجرهٔ زمانی
 *   limited   → موجودی آزاد ≤ سقف قوانین
 * (تخفیف/درصد جداگانه و زنده از compareAtPrice در UI محاسبه می‌شود)
 */
export type BadgeType = "new" | "bestseller" | "limited";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** متن سئوی اختصاصی صفحه دسته */
  seoText?: string;
  image: string;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
}

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
}

export interface ProductSize {
  id: string;
  label: string;
  /** ابعاد به سانتی‌متر، مثال: "70 × 140" */
  dimensions: string;
  /** وزن بر حسب گرم بر متر مربع — توضیح GSM */
  gsm?: number;
}

export interface ProductSpec {
  label: string;
  value: string;
}

/**
 * مدل خواندن Storefront از محصول — قرارداد ثابت UI.
 * در M1 لایه Repository این شکل را از Product + Variant دیتابیس می‌سازد.
 */
export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  /** قیمت به تومان (عدد خام — فرمت‌دهی در لایه UI) */
  price: number;
  /** قیمت قبل از تخفیف — فقط تخفیف واقعی */
  compareAtPrice?: number;
  sku: string;
  categorySlug: string;
  collectionSlugs: string[];
  images: string[];
  colors: ColorOption[];
  sizes: ProductSize[];
  specs: ProductSpec[];
  /** راهنمای نگهداری */
  care: string[];
  /** "این محصول مناسب شماست اگر..." */
  suitableFor: string[];
  features: string[];
  stock: number;
  status: ProductStatus;
  rating: number;
  reviewCount: number;
  /** برچسب‌های محاسباتی خودکار (ADR 011) — Repository با attachAutoBadges پر می‌کند */
  badges: BadgeType[];
  /** ترتیب نمایش */
  order: number;
  createdAt: string;
}

export interface Review {
  id: string;
  productSlug: string;
  userName: string;
  rating: number;
  date: string;
  comment: string;
  verifiedPurchase: boolean;
}

export interface JournalPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** پاراگراف‌های مقاله */
  content: string[];
  image: string;
  category: string;
  date: string;
  readingTime: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Testimonial {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  city: string;
}

/* ------------------------------------------------------------------ */
/* قراردادهای v2 — واحد موجودی و قیمت (ERD بخش ۴.۲ سند معماری)         */
/* ------------------------------------------------------------------ */

/**
 * واریانت — واحد شمارش موجودی و قیمت در v2.
 * در M1 از جدول Variant پرisma ساخته و به مدل خواندن Product تزریق می‌شود.
 */
export interface Variant {
  id: string;
  productId: string;
  colorId?: string;
  sizeId?: string;
  /** شناسه یکتای انبار */
  sku: string;
  /** قیمت به IRT — Integer، هیچ Float ممنوع (بخش ۱۲ سند) */
  price: number;
  /** قیمت قبل از تخفیف — صرفاً نمایشی، در محاسبه مالی وارد نمی‌شود */
  compareAtPrice?: number;
  /** موجودی فیزیکی */
  stock: number;
  /** رزروشده — قابل فروش = stock − reserved (بخش ۱۳ سند) */
  reserved: number;
  isActive: boolean;
  deletedAt?: string | null;
}

/** قید دامنه واریانت — خط دفاعی قبل از CHECK دیتابیس */
export function assertVariantInvariants(v: Pick<Variant, "stock" | "reserved">): void {
  if (!Number.isInteger(v.stock) || v.stock < 0) {
    throw new Error(`Variant stock باید Integer ≥ 0 باشد — دریافت شد: ${v.stock}`);
  }
  if (!Number.isInteger(v.reserved) || v.reserved < 0) {
    throw new Error(`Variant reserved باید Integer ≥ 0 باشد — دریافت شد: ${v.reserved}`);
  }
  if (v.stock - v.reserved < 0) {
    throw new Error("قید stock − reserved ≥ 0 نقض شد");
  }
}
