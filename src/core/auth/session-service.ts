/**
 * Session Service — چرخه حیات نشست ادمین (بخش ۹.۳ سند معماری)
 * ---------------------------------------------------------------
 * - توکن تصادفی امن ۲۵۶ بیتی (hex 64 کاراکتر) — کوکی فقط این توکن را دارد
 * - ادمین: انقضای مطلق ۸ ساعت + idle ۳۰ دقیقه (idle-slide در SessionReader)
 * - revoke: خروج دستی + اجباری (تغییر نقش، reset رمز، غیرفعال‌سازی)
 * - ثبت همه تلاش‌های ورود موفق/ناموفق در AuditLog (§20 MANDATORY_AUDIT_ACTIONS)
 */

import "server-only";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { newSessionExpiry } from "@/domain/policies/session";
import { dbSessionReader } from "./db-session-reader";
import type { AuthenticatedActor, Session } from "@/domain/models/account";
import { requirePermission, type Permission } from "./guard";
import { ADMIN_SESSION_COOKIE } from "./cookies";

/** توکن تصادفی امن — ۳۲ بایت = ۶۴ کاراکتر hex (≥ MIN_SESSION_TOKEN_LENGTH) */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export interface AdminAuthContext {
  actor: AuthenticatedActor;
  session: Session;
}

/** ساخت نشست ادمین — پس از تأیید هویت در login action */
export async function createAdminSession(input: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = newSessionExpiry(true);
  await db.session.create({
    data: {
      sessionToken: token,
      userId: input.userId,
      isAdminSession: true,
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      idleAt: new Date(),
      expiresAt,
    },
  });
  return { token, expiresAt };
}

/** خروج دستی — revoke صریح نشست جاری */
export async function revokeSessionByToken(token: string): Promise<void> {
  await db.session
    .updateMany({
      where: { sessionToken: token, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => undefined);
}

/** revoke اجباری همه نشست‌های ادمینِ یک کاربر — تغییر نقش / reset رمز (§9.3) */
export async function revokeAllSessionsForUser(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  const res = await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

/**
 * نسخه بدون-خطا برای layout پنل — null = مهمان (layout خودش ریدایرکت می‌کند).
 * برخلاف requireAdminContext خطا پرتاب نمی‌کند تا رندر صفحه ورود تمیز بماند.
 */
export async function getPanelContext(): Promise<AdminAuthContext | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value ?? "";
  if (token.length < 32) return null;

  const session = await dbSessionReader.getSession(token).catch(() => null);
  if (!session || !session.isAdminSession) return null;

  const actor = await dbSessionReader.getActor(session.userId);
  if (!actor) return null;

  return {
    actor: { ...actor, sessionId: session.id, isAdminSession: true },
    session,
  };
}

/**
 * احراز ادمین برای صفحات/اکشن‌های پنل — همیشه از requirePermission عبور می‌کند
 * (مرز امنیت = guard M0؛ این فقط wrapper راحت با context کامل نشست است).
 * نشست غیرادمینی → UNAUTHENTICATED.
 */
export async function requireAdminContext(
  permission: Permission,
): Promise<AdminAuthContext & { token: string }> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value ?? "";

  const actor = await requirePermission(permission, { sessionReader: dbSessionReader, token });
  const session = await dbSessionReader.getSession(token);
  if (!session || !session.isAdminSession) {
    const { DomainError } = await import("../errors");
    throw new DomainError("UNAUTHENTICATED", "نشست ادمین معتبر نیست. دوباره وارد شوید.");
  }

  return {
    actor: { ...actor, sessionId: session.id, isAdminSession: true },
    session,
    token,
  };
}
