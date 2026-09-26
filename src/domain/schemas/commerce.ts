/**
 * Commerce Schemas — قرارداد ورودی اکشن‌های فروش (M3/M4)
 * در لایه domain تا بدون سرور هم تست‌پذیر باشند.
 */
import { z } from "zod";
import { normalizeFaDigits, normalizePersian, normalizePostalCode } from "../text/normalize-fa";
import { normalizePhone, isValidIranMobile } from "../policies/otp";

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

/** خط سبد ورودی از UI — lineId = productId__colorId__sizeId (فرمت سبد کلاینت) */
export const checkoutLineSchema = z.object({
  lineId: z
    .string()
    .trim()
    .min(3)
    .max(260)
    .refine((v) => v.split("__").length === 3, "شناسه خط سبد نامعتبر است."),
  quantity: z.number().int().min(1).max(20),
});

/** نرمال‌سازی ارقام فارسی موبایل + اعتبارسنجی موبایل ایران */
const faPhoneSchema = z
  .string()
  .transform((v) => normalizePhone(v))
  .refine((v) => isValidIranMobile(v), "شماره موبایل معتبر نیست.");

/** کد پستی ۱۰ رقمی — BUG-13 (فاز ۳): نرمال‌ساز مشترک با اسکیمای حساب؛
 * ارقام فارسی/عربی + فاصله/خط‌تیره همه‌جا یکسان پذیرفته می‌شوند */
const postalCodeSchema = z
  .string()
  .transform(normalizePostalCode)
  .refine((v) => /^\d{10}$/.test(v), "کد پستی باید ۱۰ رقم باشد.");

export const checkoutAddressSchema = z.object({
  fullName: z.string().trim().min(3, "نام گیرنده را کامل وارد کنید.").max(80),
  phone: faPhoneSchema,
  province: z.string().trim().min(2).max(40),
  city: z.string().trim().min(2, "شهر را وارد کنید.").max(60),
  postalCode: postalCodeSchema,
  line: z.string().trim().min(10, "نشانی را کامل وارد کنید.").max(300),
});

export const shippingMethodSchema = z.enum(["standard", "express"]);

export const placeOrderSchema = z.object({
  lines: z.array(checkoutLineSchema).min(1, "سبد خرید خالی است.").max(50),
  address: checkoutAddressSchema,
  shippingMethod: shippingMethodSchema,
  couponCode: z
    .string()
    .trim()
    .max(50)
    .transform((v) => v.toUpperCase())
    .nullish(),
  note: z.string().trim().max(500).nullish(),
});

export type PlaceOrderActionInput = z.infer<typeof placeOrderSchema>;
export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;

/* ------------------------------------------------------------------ */
/* OTP (M4)                                                            */
/* ------------------------------------------------------------------ */

/** فرم ارسال OTP — فرمت بادوام؛ نرمال‌سازی سخت‌گیرانه سمت سرور */
export const otpSendSchema = z.object({
  phone: z.string().trim().min(4).max(20),
});

export const otpVerifySchema = z.object({
  phone: z.string().trim().min(4).max(20),
  code: z
    .string()
    .trim()
    .transform((v) => normalizeFaDigits(normalizePersian(v)))
    .refine((v) => /^\d{6}$/.test(v), "کد ۶ رقمی را وارد کنید."),
});

/* ------------------------------------------------------------------ */
/* Address Book (M4)                                                   */
/* ------------------------------------------------------------------ */

export const customerAddressSchema = z.object({
  fullName: z.string().trim().min(3, "نام را کامل وارد کنید.").max(80),
  phone: faPhoneSchema,
  province: z.string().trim().min(2).max(40),
  city: z.string().trim().min(2, "شهر را وارد کنید.").max(60),
  postalCode: postalCodeSchema,
  line: z.string().trim().min(10, "نشانی را کامل وارد کنید.").max(300),
  isDefault: z.boolean().optional(),
});

export const addressIdSchema = z.string().min(1).max(64);
