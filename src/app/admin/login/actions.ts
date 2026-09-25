/**
 * Admin Auth Actions — ورود/خروج ادمین (بخش ۹.۳ سند معماری)
 * ---------------------------------------------------------------
 * ورود: rate limit (سیاست signIn) → شناخت حساب (email) → bcrypt
 *      → [فعال‌سازی آینده TOTP: totpEnabled → verify] → session 8h + idle 30m
 *      → audit auth.login.success/failed (§20 اجباری)
 * خروج: revoke صریح نشست
 */

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { safeAudit } from "@/core/audit";
import { rateLimiter, RATE_RULES, rateKey } from "@/core/rate-limit";
import { ADMIN_SESSION_COOKIE } from "@/core/auth/cookies";
import { verifyPassword } from "@/core/auth/password";
import { verifyTotpCode } from "@/core/auth/totp";
import { createAdminSession, revokeSessionByToken } from "@/core/auth/session-service";
import { dbSessionReader } from "@/core/auth/db-session-reader";
import { normalizeFaDigits } from "@/domain/text/normalize-fa";
import { requestMeta } from "@/lib/admin/action-helpers";
import type { ActionResult } from "@/lib/admin/action-helpers";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("ایمیل معتبر وارد کنید."),
  password: z.string().min(1, "رمز عبور را وارد کنید."),
  totpCode: z.string().trim().optional(),
});

/** پیام یکسان برای «حساب نیست/رمز غلط» — جلوگیری از شمارش حساب‌ها */
const GENERIC_LOGIN_ERROR = "ایمیل یا رمز عبور اشتباه است.";

export async function adminLoginAction(input: {
  email: string;
  password: string;
  totpCode?: string;
}): Promise<ActionResult<{ next: string }>> {
  // نرمال‌سازی ارقام فارسی در ورودی
  const email = input.email.trim().toLowerCase();
  const parsed = loginSchema.safeParse({ ...input, email });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: { code: "VALIDATION_ERROR", message: first?.message ?? "ورودی نامعتبر." } };
  }

  const meta = await requestMeta();
  const key = rateKey("admin-signin", meta.ip, parsed.data.email);

  // ── rate limit — ۵ تلاش / ۱۵ دقیقه (سیاست signIn §9.4)
  const rl = await rateLimiter.hit(key, RATE_RULES.signIn);
  if (!rl.ok) {
    await safeAudit({
      action: "auth.login.rate_limited",
      entityType: "auth",
      entityId: parsed.data.email,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const minutes = Math.max(1, Math.ceil(rl.retryAfterMs / 60_000));
    return {
      ok: false,
      error: { code: "RATE_LIMITED", message: `تلاش‌های زیاد. ${minutes} دقیقه دیگر دوباره امتحان کنید.` },
    };
  }

  // ── شناخت حساب — فقط کاربر دارای نقش (ادمین) اجازه ورود به پنل دارد
  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    include: { role: true },
  });
  if (!user || !user.passwordHash || !user.role || !user.isActive || user.deletedAt) {
    await safeAudit({
      action: "auth.login.failed",
      entityType: "auth",
      entityId: parsed.data.email,
      ip: meta.ip,
      userAgent: meta.userAgent,
      after: { reason: "unknown_account_or_credential" },
    });
    return { ok: false, error: { code: "UNAUTHENTICATED", message: GENERIC_LOGIN_ERROR } };
  }

  // ── رمز
  const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordOk) {
    await safeAudit({
      action: "auth.login.failed",
      entityType: "auth",
      entityId: parsed.data.email,
      actorId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      after: { reason: "wrong_password" },
    });
    return { ok: false, error: { code: "UNAUTHENTICATED", message: GENERIC_LOGIN_ERROR } };
  }

  // ── TOTP — زیرساخت آماده؛ فقط وقتی مالک فعالش کند مسیر تمدید می‌شود (§9.3)
  if (user.totpEnabled && user.totpSecret) {
    const code = normalizeFaDigits(parsed.data.totpCode ?? "");
    if (!code || !verifyTotpCode(user.totpSecret, code)) {
      await safeAudit({
        action: "auth.login.failed",
        entityType: "auth",
        entityId: parsed.data.email,
        actorId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        after: { reason: "totp_invalid" },
      });
      return {
        ok: false,
        error: { code: "TOTP_REQUIRED", message: "کد دو مرحله‌ای را وارد کنید." },
      };
    }
  }

  // ── ساخت نشست + کوکی
  const { token } = await createAdminSession({
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60, // هم‌تراز انقضای مطلق ۸ ساعته (§9.3)
  });

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await safeAudit({
    action: "auth.login.success",
    entityType: "auth",
    entityId: user.id,
    actorId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    after: { email: user.email, role: user.role.name },
  });

  return { ok: true, data: { next: "/admin" } };
}

/** پرش به مقصد — بعد از لاگین موفق (کوکی ست شده) */
export async function redirectAfterLogin(next: string): Promise<never> {
  const safe = next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin";
  redirect(safe);
}

export async function adminLogoutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) {
    const session = await dbSessionReader.getSession(token).catch(() => null);
    await revokeSessionByToken(token);
    if (session) {
      const meta = await requestMeta();
      await safeAudit({
        action: "auth.logout",
        entityType: "auth",
        entityId: session.userId,
        actorId: session.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
  }
  jar.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
