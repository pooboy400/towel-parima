/**
 * DB SessionReader — پیاده‌سازی M2 قرارداد M0 (بخش ۹.۳ + ADR-005 سند)
 * ---------------------------------------------------------------
 * - منبع حقیقت نشست = جدول Session (قابل revoke واقعی + idle-timeout)
 * - اعتبارسنجی کامل: revokedAt + انقضای مطلق + idle (isSessionValid)
 * - idle-slide: هر خواندنِ معتبر، idleAt را جلو می‌برد (فعالیت = تمدید idle)
 * - نشست idle-منقضی: revoke صریح + خروج null (دسترسی بعدی 401 می‌گیرد)
 */

import "server-only";
import { db } from "@/lib/db";
import { isSessionValid } from "@/domain/policies/session";
import type { AuthenticatedActor, Session } from "@/domain/models/account";
import type { SessionReader } from "./guard";

type PrismaSessionRow = {
  id: string;
  sessionToken: string;
  userId: string;
  isAdminSession: boolean;
  ip: string | null;
  userAgent: string | null;
  idleAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

function toDomainSession(row: PrismaSessionRow): Session {
  return {
    id: row.id,
    sessionToken: row.sessionToken,
    userId: row.userId,
    isAdminSession: row.isAdminSession,
    ip: row.ip,
    userAgent: row.userAgent,
    idleAt: row.idleAt ? row.idleAt.toISOString() : null,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const dbSessionReader: SessionReader = {
  async getSession(token: string): Promise<Session | null> {
    const row = await db.session.findUnique({ where: { sessionToken: token } });
    if (!row) return null;

    const valid = isSessionValid({
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      isAdminSession: row.isAdminSession,
      idleAt: row.idleAt,
    });

    if (!valid) {
      // idle-منقضی ولی هنوز revoke نشده → revoke صریح تا شمارش دقیق بماند
      if (!row.revokedAt) {
        await db.session
          .update({ where: { id: row.id }, data: { revokedAt: new Date() } })
          .catch(() => undefined);
      }
      return null;
    }

    // فعالیت → تمدید پنجره idle (ادمین ۳۰ دقیقه؛ بخش ۹.۳)
    const now = new Date();
    const shouldSlide =
      row.isAdminSession &&
      (!row.idleAt || now.getTime() - row.idleAt.getTime() > 60_000); // حداکثر هر دقیقه
    if (shouldSlide) {
      await db.session
        .update({ where: { id: row.id }, data: { idleAt: now } })
        .catch(() => undefined);
    }

    return toDomainSession(row);
  },

  async getActor(userId: string): Promise<AuthenticatedActor | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user || !user.isActive || user.deletedAt) return null;

    return {
      userId: user.id,
      phone: user.phone,
      name: user.name,
      role: (user.role?.name ?? null) as AuthenticatedActor["role"],
      permissions: user.role?.permissions ?? [],
      sessionId: "",
      isAdminSession: false,
    };
  },
};
