import type { StoreConfig } from "@/types";

/**
 * پیکربندی فروشگاه — پرامپت 114: Currency configurable باشد، architecture
 * نباید hard-coded باشد.
 * این فایل فقط «مقادیر پیش‌فرض/seed» است؛ منبع حقیقتِ نمایش، Setting دیتابیسی
 * است (store.config / store.shipping) که از settings-service خوانده می‌شود و
 * ادمین از /admin/settings آن را ویرایش می‌کند. اگر Setting نبود، همین‌جا
 * به‌عنوان fallback ایمن استفاده می‌شود.
 */
export const storeConfig: StoreConfig = {
  brandName: "پریما",
  brandNameEn: "PRIMA",
  currencyLabel: "تومان",
  freeShippingThreshold: 1_500_000,
  standardShippingCost: 89_000,
  expressShippingCost: 189_000,
  contact: {
    phone: "۰۲۱-۹۱۰۰۹۱۰۰",
    email: "hello@prima-towel.ir",
    address: "تهران، خیابان ولیعصر، برج مرکزی، طبقه ۹",
    workingHours: "شنبه تا پنجشنبه، ۹ صبح تا ۶ عصر",
    instagram: "https://instagram.com/prima.towel",
  },
};

/** مدت آماده‌سازی و ارسال — پرامپت 36 (پیش‌فرض seed؛ نسخهٔ زنده از DB خوانده می‌شود) */
export const shippingInfo = {
  preparationDays: "۱ روز کاری",
  standardDays: "۲ تا ۴ روز کاری",
  expressDays: "روز بعد",
  returnWindowDays: 7,
  exchangeWindowDays: 14,
};

/** آستانهٔ «تنها X عدد در انبار» — یک منبع واحد برای کارت محصول، صفحه محصول و داشبورد ادمین */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * قوانین برچسب‌های خودکار (ADR 011) — پیش‌فرض seed برای Setting «store.badgeRules».
 * منبع حقیقتِ زنده از settings-service (getBadgeRulesSafe) می‌آید و ادمین از
 * /admin/settings آن را ویرایش می‌کند. هیچ‌کدام از این اعداد در UI سفت نیست.
 */
export const DEFAULT_BADGE_RULES = {
  /** محصول کمتر از این تعداد روز از افزودن → برچسب «جدید» */
  newDays: 14,
  /** حداقل فروش پرداخت‌شدهٔ واقعی → برچسب «پرفروش» */
  bestsellerMinSales: 5,
  /** پنجرهٔ شمارش فروش پرفروش (روز) */
  bestsellerWindowDays: 30,
  /** موجودی آزاد ≤ این عدد → برچسب «محدود» */
  limitedMaxStock: 10,
} as const;

/** سقف تعداد هر قلم سبد — طبق ERD سند (CartItem.quantity: 1..20) */
export const MAX_CART_QUANTITY = 20;

/** کالکشن ویژهٔ صفحهٔ اصلی — پیش‌فرض seed برای Setting «home.featured» (از ادمین قابل تغییر) */
export const DEFAULT_FEATURED_COLLECTION_SLUG = "spa";
