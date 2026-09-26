/**
 * OtpAuthService — ورود با کد پیامکی (بخش ۹.۴ سند)
 * ---------------------------------------------------------------
 * سیاست: ۶ رقم crypto-safe · hash SHA-256+salt · TTL ۵ دقیقه · حداکثر ۵ تلاش
 * · مصرف یک‌بار (atomik updateMany where usedAt:null — گارد رقابت) · cooldown
 * ۹۰ ثانیه · rate limit (ارسال ۳/۱۰min per phone، ۱۰/۱h per IP، بررسی ۵/۱۵min)
 *
 * دو جهان جدا: اکانت‌های ادمین/کارکنان (roleId غیر null) با OTP ورود نمی‌کنند.
 * شماره تازه = ساخت خودکار اکانت مشتری (passwordHash null).
 */

import "server-only";
import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { smsProvider } from "@/providers/sms";
import { rateLimiter } from "@/core/rate-limit";
import { RATE_RULES, rateKey } from "@/core/rate-limit/policies";
import {
  OTP_POLICY,
  normalizePhone,
  generateOtpCode,
  hashOtpCode,
  verifyOtpAttempt,
  otpFailureToError,
} from "@/domain/policies/otp";

export interface SendOtpResult {
  cooldownSeconds: number;
  /** فقط در غیر production برای تست — هرگز در تولید */
  devCode?: string;
}

/** ارسال کد ورود — همه گاردها قبل از تولید/ارسال */
export async function sendOtp(input: {
  phoneRaw: string;
  ip?: string | null;
}): Promise<SendOtpResult> {
  const phone = normalizePhone(input.phoneRaw);
  if (!/^09\d{9}$/.test(phone)) {
    throw new DomainError("VALIDATION_ERROR", "شماره موبایل معتبر نیست.");
  }

  // ── rate limits (§9.4) — همزمان با ساخت endpoint، نه به تعویق
  const phoneWindow = await rateLimiter.hit(
    rateKey("otp-send", "phone", phone),
    RATE_RULES.otpSendPerPhone,
  );
  if (!phoneWindow.ok) {
    throw new DomainError("RATE_LIMITED", "تعداد درخواست کد زیاد است — کمی بعد تلاش کنید.");
  }
  if (input.ip) {
    const ipWindow = await rateLimiter.hit(
      rateKey("otp-send", "ip", input.ip),
      RATE_RULES.otpSendPerIp,
    );
    if (!ipWindow.ok) {
      throw new DomainError("RATE_LIMITED", "درخواست‌های زیاد — لطفاً بعداً تلاش کنید.");
    }
  }

  // ── cooldown ۹۰ ثانیه بین دو ارسال
  const last = await db.otpCode.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last) {
    const elapsed = Date.now() - last.createdAt.getTime();
    if (elapsed < OTP_POLICY.resendCooldownMs) {
      const waitSeconds = Math.ceil((OTP_POLICY.resendCooldownMs - elapsed) / 1000);
      throw new DomainError(
        "RATE_LIMITED",
        `برای دریافت کد جدید ${waitSeconds} ثانیه صبر کنید.`,
      );
    }
  }

  // ── گارد اکانت ادمین/کارمند (دو جهان جدا)
  const existing = await db.user.findUnique({
    where: { phone },
    select: { roleId: true, isActive: true, deletedAt: true },
  });
  if (existing?.roleId) {
    throw new DomainError(
      "CONFLICT",
      "این شماره متعلق به حساب کارکنان است — از صفحه ورود پنل استفاده کنید.",
    );
  }
  if (existing && (!existing.isActive || existing.deletedAt)) {
    throw new DomainError("FORBIDDEN", "این حساب غیرفعال شده است.");
  }

  // ── ساخت کد + ذخیره hash
  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  await db.otpCode.create({
    data: {
      phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_POLICY.ttlMs),
    },
  });

  // ── ارسال SMS — خارج از tx (قانون طلایی §10.3)
  await smsProvider.send({
    to: phone,
    tag: "otp-login",
    text: `کد ورود شما به پریما: ${code}\nاین کد ۵ دقیقه اعتبار دارد.`,
  });

  return {
    cooldownSeconds: Math.ceil(OTP_POLICY.resendCooldownMs / 1000),
    ...(includeDevCodeInResponse() ? { devCode: code } : {}),
  };
}

/**
 * SEC-11 (فاز ۳) — devCode فقط با شرطِ ثابتِ بیلد: در بیلد production این
 * شرط به literal(false) فرومی‌ریزد و کل مسیر dead-code-eliminate می‌شود —
 * کد OTP هرگز از مرز build عبور نمی‌کند (نه فقط گارد ران‌تایم).
 * دموی production (§ALLOW_MOCKS_IN_PRODUCTION) کد را از مسیر provider mock
 * پیامک می‌گیرد، نه از پاسخ API.
 */
function includeDevCodeInResponse(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

export interface VerifyOtpResult {
  userId: string;
  name: string | null;
  isNewAccount: boolean;
  /** موبایل نرمال‌شده 09... — برای همگام‌سازی UI */
  phone: string;
}

/**
 * بررسی کد + ورود — در صورت نبود اکانت، ساخت خودکار مشتری.
 * مصرف کد با updateMany شرطی اتمیک است — دو تلاش همزمان فقط یکی برنده می‌شود.
 */
export async function verifyOtpAndLogin(input: {
  phoneRaw: string;
  codeRaw: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<VerifyOtpResult> {
  const phone = normalizePhone(input.phoneRaw);
  if (!/^09\d{9}$/.test(phone)) {
    throw new DomainError("VALIDATION_ERROR", "شماره موبایل معتبر نیست.");
  }

  const verifyWindow = await rateLimiter.hit(
    rateKey("otp-verify", "phone", phone),
    RATE_RULES.otpVerifyPerPhone,
  );
  if (!verifyWindow.ok) {
    throw new DomainError("RATE_LIMITED", "تلاش‌های زیاد — کمی بعد دوباره امتحان کنید.");
  }

  const record = await db.otpCode.findFirst({
    where: { phone, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) {
    throw new DomainError("VALIDATION_ERROR", "کدی برای این شماره ارسال نشده — کد جدید بگیرید.");
  }

  const submittedHash = await hashOtpCode(input.codeRaw.trim());
  const result = verifyOtpAttempt(
    {
      codeHash: record.codeHash,
      expiresAt: record.expiresAt,
      attemptCount: record.attemptCount,
      usedAt: record.usedAt,
    },
    input.codeRaw.trim(),
    submittedHash,
  );

  if (!result.ok) {
    // BUG-10 (فاز ۳) — شمارش اتمیک تلاش: بورست موازیِ بین-خواندن-و-افزایش
    // نمی‌تواند از سقف ۵ عبور کند (شرط lt در همان UPDATE)
    const bumped = await db.otpCode.updateMany({
      where: { id: record.id, attemptCount: { lt: OTP_POLICY.maxAttempts } },
      data: { attemptCount: { increment: 1 } },
    });
    if (bumped.count === 0) {
      throw new DomainError(
        "CONFLICT",
        "تعداد تلاش‌ها بیش از حد مجاز است. کد جدید بگیرید.",
      );
    }
    throw otpFailureToError(result.failure ?? "MISMATCH");
  }

  // ── مصرف اتمیک یک‌بار — گارد رقابت (§9.4)
  const consumed = await db.otpCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count === 0) {
    throw new DomainError("CONFLICT", "این کد قبلاً استفاده شده است.");
  }

  // ── ورود یا ساخت خودکار
  const user = await db.user.findUnique({
    where: { phone },
    select: { id: true, name: true, roleId: true, isActive: true, deletedAt: true },
  });

  if (user?.roleId) {
    throw new DomainError(
      "CONFLICT",
      "این شماره متعلق به حساب کارکنان است — از صفحه ورود پنل استفاده کنید.",
    );
  }
  if (user && (!user.isActive || user.deletedAt)) {
    throw new DomainError("FORBIDDEN", "این حساب غیرفعال شده است.");
  }

  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return { userId: user.id, name: user.name, isNewAccount: false, phone };
  }

  const created = await db.user.create({
    data: {
      phone,
      name: null,
      lastLoginAt: new Date(),
    },
    select: { id: true, name: true },
  });

  // خوش‌آمد — از Outbox (M5 worker ارسال می‌کند)
  const { enqueueOutbox } = await import("@/core/commerce/outbox-service");
  await db.$transaction((tx) =>
    enqueueOutbox(tx, {
      type: "CustomerWelcome",
      payload: { userId: created.id, phone },
    }),
  );

  return { userId: created.id, name: created.name, isNewAccount: true, phone };
}
