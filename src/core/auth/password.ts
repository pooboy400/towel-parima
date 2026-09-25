/**
 * Password — هش و سیاست رمز (بخش ۹.۳ سند معماری)
 * ---------------------------------------------------------------
 * - هش با bcrypt (cost 12) طبق سند: «حداقل ۱۰ کاراکتر، هش argon2/bcrypt(12)»
 * - رمز خام هرگز لاگ/ذخیره/audit نمی‌شود — فقط هش در User.passwordHash
 * - policy: حداقل ۱۰ کاراکتر + حداقل یک حرف + یک رقم
 */

import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;

/** سیاست رمز ادمین — پیام‌های فارسی برای UI */
export const PASSWORD_POLICY = {
  minLength: 10,
  message: "رمز عبور باید حداقل ۱۰ کاراکتر و شامل حرف و رقم باشد.",
} as const;

/** بررسی سیاست رمز — بدون برگرداندن جزئیات رمز */
export function isValidPassword(password: string): boolean {
  if (password.length < PASSWORD_POLICY.minLength) return false;
  if (!Number.isInteger(BCRYPT_COST)) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  return hasLetter && hasDigit;
}

/** هش رمز — فقط در Server Action/seed فراخوانی شود (سرور) */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** مقایسه رمز با هش — زمان‌ثابت (داخل bcrypt) */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/** رمز تصادفی قابل‌خواندن برای bootstrap حساب ادمین (فقط یک‌بار چاپ می‌شود) */
export function generateStrongPassword(length = 16): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  // تضمین policy: حرف + رقم
  if (!/[0-9]/.test(out)) out = `7${out.slice(1)}`;
  if (!/[a-zA-Z]/.test(out)) out = `k${out.slice(1)}`;
  return out;
}
