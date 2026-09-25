/**
 * Customer Session — نشست مشتری (بخش ۹.۳ سند)
 * ---------------------------------------------------------------
 * · انقضای مطلق ۳۰ روز sliding — با هر فعالیت تمدید (با آستانه برای پرهیز
 *   از write در هر request)
 * · کوکی جدا از ادمین (prima_session) · httpOnly · sameSite=lax · secure در prod
 * · revoke صریح هنگام خروج
 * · برخلاف ادمین: idle-timeout ندارد
 */

import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { newSessionToken } from "./session-service";
import { CUSTOMER_SESSION_COOKIE } from "./cookies";

export interface CustomerContext {
  userId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  passwordSet: boolean;
  sessionId: string;
}

/** آستانه تمدید sliding: فقط وقتی بیش از ۱ روز از عمر نشست گذشته باشد */
const RENEW_THRESHOLD_MS = 24 * 60 * 60_000;

/** ساخت نشست مشتری — پس از موفقیت login (رمز یا OTP) در Action layer */
export async function createCustomerSession(input: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  await db.session.create({
    data: {
      sessionToken: token,
      userId: input.userId,
      isAdminSession: false,
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      expiresAt,
    },
  });

  const jar = await cookies();
  jar.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

/** context مشتری از کوکی — null یعنی مهمان. با فعالیت تمدید می‌شود (sliding). */
export async function getCustomerContext(): Promise<CustomerContext | null> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_SESSION_COOKIE)?.value ?? "";
  if (token.length < 32) return null;

  const session = await db.session.findFirst({
    where: {
      sessionToken: token,
      isAdminSession: false,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      user: {
        select: {
          name: true,
          phone: true,
          email: true,
          isActive: true,
          deletedAt: true,
          passwordHash: true,
        },
      },
    },
  });
  if (!session || !session.user.isActive || session.user.deletedAt) return null;

  // sliding — تمدید ۳۰ روزه با آستانه
  if (session.expiresAt.getTime() - Date.now() < 30 * 24 * 60 * 60_000 - RENEW_THRESHOLD_MS) {
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60_000);
    await db.session
      .update({ where: { id: session.id }, data: { expiresAt: newExpiry } })
      .catch(() => undefined);
    try {
      jar.set(CUSTOMER_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: newExpiry,
      });
    } catch {
      // در رندر سرور کوکی‌خواندنی ممکن است set ممنوع باشد — بی‌ضرر
    }
  }

  return {
    userId: session.userId,
    name: session.user.name,
    phone: session.user.phone,
    email: session.user.email,
    passwordSet: Boolean(session.user.passwordHash),
    sessionId: session.id,
  };
}

/** برای اکشن‌های نیازمند لاگین — UNAUTHENTICATED به‌جای null */
export async function requireCustomerContext(): Promise<CustomerContext> {
  const ctx = await getCustomerContext();
  if (!ctx) {
    const { DomainError } = await import("@/core/errors");
    throw new DomainError("UNAUTHENTICATED", "برای این کار ابتدا وارد حساب شوید.");
  }
  return ctx;
}

/** خروج — revoke صریح + پاک‌کردن کوکی */
export async function revokeCustomerSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_SESSION_COOKIE)?.value ?? "";
  if (token.length >= 32) {
    await db.session
      .updateMany({
        where: { sessionToken: token, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  jar.delete(CUSTOMER_SESSION_COOKIE);
}
