/**
 * Rate Limit — جدول سقف‌های کانونی (بخش ۹.۴ سند معماری)
 * ---------------------------------------------------------------
 * هر endpoint حساس هنگام ساخته‌شدن به یکی از این سیاست‌ها وصل می‌شود —
 * افزودن rate limit «همزمان با ساخت endpoint» است، نه به تعویق M6.
 */

import type { RateLimitRule } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RATE_RULES = {
  /** sendOtp — per phone */
  otpSendPerPhone: { limit: 3, windowMs: 10 * MINUTE },
  /** sendOtp — per IP */
  otpSendPerIp: { limit: 10, windowMs: HOUR },
  /** verifyOtp — per phone */
  otpVerifyPerPhone: { limit: 5, windowMs: 15 * MINUTE },
  /** signIn با رمز — per IP+شناسه */
  signIn: { limit: 5, windowMs: 15 * MINUTE },
  /** signIn ادمین — per email (SEC-03: مستقل از IP؛ با چرخش IP/XFF هم قفل می‌شود) */
  signInPerEmail: { limit: 10, windowMs: HOUR },
  /** شروع پرداخت — per user */
  paymentStart: { limit: 5, windowMs: 10 * MINUTE },
  /** اعمال کوپن — per user */
  couponApply: { limit: 10, windowMs: 10 * MINUTE },
  /** ثبت نظر — per user */
  reviewSubmit: { limit: 3, windowMs: DAY },
  /** فرم تماس — per IP */
  contactSubmit: { limit: 3, windowMs: 10 * MINUTE },
  /** خبرنامه — per IP */
  newsletterSubscribe: { limit: 5, windowMs: HOUR },
  /** GET /api/search — per IP */
  search: { limit: 30, windowMs: MINUTE },
  /** پیگیری سفارش (صفحه) — per IP (SEC-04: سد ارقام‌زنی کد رهگیری) */
  orderTracking: { limit: 30, windowMs: MINUTE },
  /** بقیه APIهای عمومی — per IP */
  publicApi: { limit: 120, windowMs: MINUTE },
  /** HEALTH-MON-01 (فاز ۳) — سقف مستقل health (مانیتور منظم + پروب‌ها نباید هم‌سقف publicApi بمانند) */
  healthCheck: { limit: 60, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export type RateRuleName = keyof typeof RATE_RULES;

/** ساخت کلید استاندارد — ترکیب چند بعد (IP + phone) با جداکننده امن */
export function rateKey(...parts: readonly (string | undefined | null)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join(":");
}
