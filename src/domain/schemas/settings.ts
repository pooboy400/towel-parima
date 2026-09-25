/**
 * Settings Schemas — قرارداد دامنه Setting (بخش ۱۸ سند)
 * ---------------------------------------------------------------
 * در لایه domain هستند تا هم Service و هم تست‌های unit بدون وابستگی
 * به server/Next از آن‌ها استفاده کنند. UI هرگز JSON خام نمی‌بیند.
 */
import { z } from "zod";

export const storeConfigSchema = z.object({
  brandName: z.string().min(1),
  brandNameEn: z.string().min(1),
  currencyLabel: z.string().min(1),
  freeShippingThreshold: z.number().int().nonnegative(),
  standardShippingCost: z.number().int().nonnegative(),
  expressShippingCost: z.number().int().nonnegative(),
  contact: z.object({
    phone: z.string().min(1),
    email: z.string().email(),
    address: z.string().min(1),
    workingHours: z.string().min(1),
    instagram: z.string().url(),
  }),
});

export const shippingInfoSchema = z.object({
  preparationDays: z.string().min(1),
  standardDays: z.string().min(1),
  expressDays: z.string().min(1),
  returnWindowDays: z.number().int().nonnegative(),
  exchangeWindowDays: z.number().int().nonnegative(),
});

/** بخش «home.featured» — کالکشن ویژهٔ صفحهٔ اصلی (قابل تغییر از ادمین) */
export const homeSettingsSchema = z.object({
  featuredCollectionSlug: z.string().min(1),
  /** تیتر بنر کالکشن ویژه — اگر کالکشن عوض شود ادمین آن را هم ویرایش می‌کند */
  headline: z.string().min(1).default("حس اسپا، در خانه خودتان"),
});

/**
 * قوانین برچسب‌های خودکار (store.badgeRules) — ADR 011.
 * برچسب‌های جدید/پرفروش/محدود از این قوانین محاسبه می‌شوند؛ ادمین از
 * /admin/settings تغییرشان می‌دهد. هیچ عدد سیاستی در کد سفت نیست.
 */
export const badgeRulesSchema = z.object({
  newDays: z.number().int().min(1).max(90),
  bestsellerMinSales: z.number().int().min(1).max(1000),
  bestsellerWindowDays: z.number().int().min(1).max(365),
  limitedMaxStock: z.number().int().min(1).max(100),
});

export const testimonialSchema = z.object({
  id: z.string(),
  userName: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  city: z.string(),
});

export type StoreConfigV2 = z.infer<typeof storeConfigSchema>;
export type ShippingInfoV2 = z.infer<typeof shippingInfoSchema>;
export type HomeSettingsV2 = z.infer<typeof homeSettingsSchema>;
export type BadgeRulesV2 = z.infer<typeof badgeRulesSchema>;
export type TestimonialV2 = z.infer<typeof testimonialSchema>;
