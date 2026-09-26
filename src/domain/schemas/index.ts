/**
 * Zod Schemas v2 — قرارداد اعتبارسنجی مشترک (زنجیره ۲.۲ سند)
 * ---------------------------------------------------------------
 * این اسکیماها مرز ورودی همه Actionها و API Routes آینده‌اند.
 * ⚠️ Zod فقط Validation است و به هیچ عنوان Authorization نیست.
 * اسکیماهای فاز ۱ در src/lib/validations.ts دست‌نخورده می‌مانند تا پایان M1.
 */

import { z } from "zod";
import { normalizePostalCode } from "../text/normalize-fa";

/* ------------------------------------------------------------------ */
/* مشترک                                                                */
/* ------------------------------------------------------------------ */

/** تبدیل ارقام فارسی/عربی به لاتین قبل از قاعده — بدون دست‌زدن به بقیه متن */
const latinDigits = (v: string) =>
  v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
   .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export const phoneSchema = z
  .string()
  .trim()
  .transform(latinDigits)
  .pipe(z.string().regex(/^09\d{9}$/, "شماره موبایل معتبر نیست (مثال: 09121234567)"));

export const otpCodeSchema = z
  .string()
  .trim()
  .transform(latinDigits)
  .pipe(z.string().regex(/^\d{6}$/, "کد تأیید ۶ رقمی است"));

/** مبلغ IRT — Integer غیرمنفی */
export const moneySchema = z
  .number()
  .int("مبلغ باید عدد صحیح باشد")
  .nonnegative("مبلغ نمی‌تواند منفی باشد");

/** شناسه cuid */
export const cuidSchema = z.string().min(1).max(64);

/* ------------------------------------------------------------------ */
/* Auth — OTP (بخش ۹.۴ سند)                                             */
/* ------------------------------------------------------------------ */

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/* ------------------------------------------------------------------ */
/* آدرس — هم‌راستا با ShippingAddressSnapshot دامنه                      */
/* ------------------------------------------------------------------ */

export const addressV2Schema = z.object({
  fullName: z.string().trim().min(3, "نام و نام خانوادگی را وارد کنید").max(80),
  phone: phoneSchema,
  province: z.string().trim().min(2, "استان را وارد کنید").max(40),
  city: z.string().trim().min(2, "شهر را وارد کنید").max(40),
  // BUG-13 (فاز ۳) — همان نرمال‌ساز مشترک چک‌اوت: ارقام فارسی + فاصله/خط‌تیره
  postalCode: z
    .string()
    .transform(normalizePostalCode)
    .pipe(z.string().regex(/^\d{10}$/, "کد پستی باید ۱۰ رقم باشد")),
  line: z.string().trim().min(10, "آدرس کامل‌تر وارد کنید").max(400),
  isDefault: z.boolean().optional(),
});

export type AddressV2Input = z.infer<typeof addressV2Schema>;

/* ------------------------------------------------------------------ */
/* سبد و Checkout — تعداد 1..20 (ERD سند)                               */
/* ------------------------------------------------------------------ */

export const cartItemV2Schema = z.object({
  variantId: cuidSchema,
  quantity: z.number().int().min(1, "حداقل ۱ عدد").max(20, "حداکثر ۲۰ عدد در هر قلم"),
});

export const checkoutSchema = z.object({
  items: z.array(cartItemV2Schema).min(1, "سبد خرید خالی است").max(50),
  address: addressV2Schema,
  couponCode: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v.toUpperCase())
    .optional(),
  note: z.string().trim().max(300, "یادداشت حداکثر ۳۰۰ کاراکتر است").optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/* ------------------------------------------------------------------ */
/* کوپن                                                                 */
/* ------------------------------------------------------------------ */

export const applyCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "کد تخفیف را وارد کنید")
    .max(40, "کد تخفیف طولانی است")
    .transform((v) => v.toUpperCase()),
  /** جمع سبد فعلی برای بررسی minSubtotal — سمت سرور دوباره محاسبه می‌شود */
  subtotal: moneySchema,
});

export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

/* ------------------------------------------------------------------ */
/* نظر محصول                                                            */
/* ------------------------------------------------------------------ */

export const submitReviewSchema = z.object({
  productSlug: z.string().trim().min(1).max(120),
  rating: z.number().int().min(1, "امتیاز بین ۱ تا ۵").max(5, "امتیاز بین ۱ تا ۵"),
  authorName: z.string().trim().min(2, "نام خود را وارد کنید").max(60),
  body: z
    .string()
    .trim()
    .min(10, "متن نظر حداقل ۱۰ کاراکتر باشد")
    .max(2000, "متن نظر حداکثر ۲۰۰۰ کاراکتر است"),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
