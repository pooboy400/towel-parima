/**
 * TOTP — ورود دومرحله‌ای (RFC 6238) — بخش ۹.۳ سند معماری
 * ---------------------------------------------------------------
 * ⚠️ وضعیت فعلی: «زیرساخت آماده، فیوز خاموش».
 *   - هیچ جریان لاگینی به این ماژول وابسته نیست تا مالک دستور فعال‌سازی دهد.
 *   - فعال‌سازی = set کردن User.totpSecret + totpEnabled توسط اکشن مخصوص.
 * - pure و بدون وابستگی — قابل تست با بردارهای RFC.
 * - Secret فقط base32 رمزنگاری‌شده ذخیره می‌شود؛ QR در زمان setup ساخته می‌شود.
 */

import { createHmac, randomBytes } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

/* ------------------------------------------------------------------ */
/* Base32                                                              */
/* ------------------------------------------------------------------ */

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("base32: کاراکتر نامعتبر");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/* ------------------------------------------------------------------ */
/* Secret + URI                                                        */
/* ------------------------------------------------------------------ */

/** Secret تصادفی ۲۰ بایتی (۱۶۰ بیت — توصیه RFC) به base32 */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** URI استاندارد otpauth — اپ‌های Authenticator آن را به QR تبدیل می‌کنند */
export function buildOtpauthUri(secret: string, account: string, issuer = "PRIMA"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/* کدسازی و راستی‌آزمایی                                               */
/* ------------------------------------------------------------------ */

/** محاسبه کد TOTP برای یک پنجره زمانی مشخص (برای تست‌ها هم کاربرد دارد) */
export function totpAt(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function currentCounter(now = new Date()): number {
  return Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);
}

/**
 * راستی‌آزمایی کد با پنجره ±۱ (تأخیر ساعت گوشی).
 * مقایسه با stringpad ثابت — نه زمان‌ثابت کامل، ولی ریسک timing در ۶ رقم ناچیز است.
 */
export function verifyTotpCode(
  secret: string,
  code: string,
  now = new Date(),
  window = 1,
): boolean {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== TOTP_DIGITS) return false;
  const counter = currentCounter(now);
  // INFRA-08/1 (فاز ۶) — مقایسهٔ زمان-ثابت (قبلاً === رشته‌ای بود)
  for (let drift = -window; drift <= window; drift++) {
    const candidate = totpAt(secret, counter + drift);
    if (timingSafeEqualStrings(candidate, normalized)) return true;
  }
  return false;
}

/** مقایسهٔ زمان-ثابت برای دو رشتهٔ هم‌طول (کد TOTP همیشه ۶ رقم است) */
function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
