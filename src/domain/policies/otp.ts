/**
 * Policy — امنیت OTP (بخش ۹.۴ سند معماری)
 * ---------------------------------------------------------------
 * توابع pure و تست‌پذیر؛ ذخیره‌سازی در M1+ به جدول OtpCode وصل می‌شود.
 * قوانین: hash · انقضا ۵ دقیقه · ۵ تلاش · مصرف یک‌بار · cooldown ۹۰ ثانیه.
 */

import { DomainError } from "../../core/errors";
import { allowMocksInProduction } from "../../core/env";
import { normalizeFaDigits, normalizePersian } from "../text/normalize-fa";

export const OTP_POLICY = {
  /** عمر کد */
  ttlMs: 5 * 60_000,
  /** حداکثر تلاش بررسی برای هر کد */
  maxAttempts: 5,
  /** فاصله اجباری بین دو ارسال برای یک شماره */
  resendCooldownMs: 90_000,
  /** طول کد */
  length: 6,
} as const;

/** نرمال‌سازی شماره موبایل ایران: ارقام فارسی/عربی → لاتین، حذف جداکننده‌ها */
export function normalizePhone(input: string): string {
  const digits = normalizeFaDigits(normalizePersian(input)).replace(/[\s\-()+]/g, "");
  // 0098 / +98 / 98 → 0
  const m = digits.match(/^(?:0098|\+98|98|0)?(9\d{9})$/);
  return m ? `0${m[1]}` : digits;
}

export function isValidIranMobile(phone: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(phone));
}

/** ساخت کد عددی تصادفی — crypto-safe */
export function generateOtpCode(length = OTP_POLICY.length): string {
  const bytes = new Uint32Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += String(bytes[i] % 10);
  return out;
}

/**
 * hash کد — SHA-256 با salt سرور (env).
 * ⚠️ OTP عمر کوتاه دارد و SHA-256 با salt برای این threat model کافی است؛
 * رمزهای بلندمدت (password) با argon2/bcrypt هش می‌شوند نه این تابع.
 *
 * SEC-09 (فاز ۳) — salt هاردکد دیگر در production بی‌صدا استفاده نمی‌شود:
 * اگر OTP_HASH_SALT ست نشده باشد و محیط production (بدون فلگ دمو) باشد،
 * همین‌جا crash-fast می‌کنیم تا hash با salt عمومی انجام نگیرد.
 */
export async function hashOtpCode(code: string): Promise<string> {
  let salt = process.env.OTP_HASH_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === "production" && !allowMocksInProduction()) {
      throw new Error(
        "SEC-09: OTP_HASH_SALT تنظیم نشده است — در production یک رشتهٔ تصادفی ≥۳۲ کاراکتری ست کنید (fail-fast؛ fallback dev فقط برای توسعه/تست است).",
      );
    }
    salt = "prima-dev-salt"; // فقط توسعه/تست — هرگز production
  }
  const data = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface OtpVerificationInput {
  codeHash: string;
  expiresAt: Date;
  attemptCount: number;
  usedAt: Date | null;
}

export type OtpVerificationFailure =
  | "NOT_FOUND" // بدون رکورد
  | "EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "ALREADY_USED"
  | "MISMATCH";

export interface OtpVerificationResult {
  ok: boolean;
  failure?: OtpVerificationFailure;
  /** در صورت MISMATCH: تعداد تلاش مصرف‌شده برای سقف ۵ تایی */
  attemptsLeft?: number;
}

/** بررسی خالص یک تلاش — بدون I/O؛ مدیریت attemptCount با فراخواننده است */
export function verifyOtpAttempt(
  record: OtpVerificationInput,
  submittedCode: string,
  codeHashOfSubmitted: string,
): OtpVerificationResult {
  if (record.usedAt) return { ok: false, failure: "ALREADY_USED" };
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false, failure: "EXPIRED" };
  if (record.attemptCount >= OTP_POLICY.maxAttempts) {
    return { ok: false, failure: "TOO_MANY_ATTEMPTS" };
  }
  // مقایسه رشته هش با مقایسه زمان‌ثابت ساده — طول ثابت hex
  if (!timingSafeEqual(record.codeHash, codeHashOfSubmitted)) {
    return {
      ok: false,
      failure: "MISMATCH",
      attemptsLeft: OTP_POLICY.maxAttempts - record.attemptCount - 1,
    };
  }
  return { ok: true };
}

/** مقایسه زمان‌ثابت برای رشته‌های هم‌طول (جلوگیری از timing attack) */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** خطای استاندارد از نتیجه بررسی — برای Action لایه بالاتر */
export function otpFailureToError(failure: OtpVerificationFailure): DomainError {
  switch (failure) {
    case "EXPIRED":
      return new DomainError("CONFLICT", "کد تأیید منقضی شده است. کد جدید بگیرید.");
    case "TOO_MANY_ATTEMPTS":
      return new DomainError("CONFLICT", "تعداد تلاش‌ها بیش از حد مجاز است. کد جدید بگیرید.");
    case "ALREADY_USED":
      return new DomainError("CONFLICT", "این کد قبلاً استفاده شده است.");
    default:
      return new DomainError("VALIDATION_ERROR", "کد تأیید اشتباه است.");
  }
}
