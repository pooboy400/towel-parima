/**
 * Customer Auth Service — ورود دوگانه مشتری (M4)
 * ---------------------------------------------------------------
 * مسیر رمز: شماره موبایل + رمز — rate limit §9.4 (5/15min per IP+شناسه).
 * مسیر OTP: otp-auth-service.ts.
 * دو جهان جدا: اکانت کارکنان (roleId غیر null) فقط از پنل ادمین وارد می‌شود.
 */

import "server-only";
import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { rateLimiter } from "@/core/rate-limit";
import { RATE_RULES, rateKey } from "@/core/rate-limit/policies";
import { normalizePhone } from "@/domain/policies/otp";
import { verifyPassword } from "./password";

export interface CustomerSignInResult {
  userId: string;
  name: string | null;
  phone: string;
}

export async function signInWithPassword(input: {
  phoneRaw: string;
  password: string;
  ip?: string | null;
}): Promise<CustomerSignInResult> {
  const phone = normalizePhone(input.phoneRaw);
  if (!/^09\d{9}$/.test(phone)) {
    throw new DomainError("VALIDATION_ERROR", "شماره موبایل معتبر نیست.");
  }
  if (!input.password) {
    throw new DomainError("VALIDATION_ERROR", "رمز عبور را وارد کنید.");
  }

  const window = await rateLimiter.hit(
    rateKey("customer-signin", input.ip ?? "noip", phone),
    RATE_RULES.signIn,
  );
  if (!window.ok) {
    throw new DomainError(
      "RATE_LIMITED",
      "تلاش‌های ورود زیاد است — ۱۵ دقیقه بعد دوباره امتحان کنید.",
    );
  }

  const user = await db.user.findUnique({
    where: { phone },
    select: {
      id: true,
      name: true,
      passwordHash: true,
      roleId: true,
      isActive: true,
      deletedAt: true,
    },
  });

  // پیام یکسان برای نبود حساب/رمز — نشت اطلاعات حساب‌ها ممنوع
  if (!user || !user.passwordHash) {
    throw new DomainError("UNAUTHENTICATED", "شماره موبایل یا رمز عبور اشتباه است.");
  }
  if (user.roleId) {
    throw new DomainError(
      "CONFLICT",
      "این شماره متعلق به حساب کارکنان است — از صفحه ورود پنل استفاده کنید.",
    );
  }
  if (!user.isActive || user.deletedAt) {
    throw new DomainError("FORBIDDEN", "این حساب غیرفعال شده است.");
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new DomainError("UNAUTHENTICATED", "شماره موبایل یا رمز عبور اشتباه است.");
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { userId: user.id, name: user.name, phone };
}
