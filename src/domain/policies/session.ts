/**
 * Policy — نشست‌ها (بخش ۹.۳ سند معماری)
 * ---------------------------------------------------------------
 * مشتری: ۳۰ روز sliding · ادمین: ۸ ساعت مطلق + idle ۳۰ دقیقه.
 * محاسبات pure — ذخیره‌سازی/به‌روزرسانی idleAt در M1+.
 */

export const SESSION_POLICY = {
  customer: {
    /** انقضای مطلق — با هر فعالیت تمدید می‌شود (sliding) */
    absoluteTtlMs: 30 * 24 * 60 * 60_000,
  },
  admin: {
    /** ۸ ساعت از ورود — تمدید نمی‌شود */
    absoluteTtlMs: 8 * 60 * 60_000,
    /** بدون فعالیت ۳۰ دقیقه → revoke */
    idleTimeoutMs: 30 * 60_000,
  },
} as const;

/** زمان انقضای session جدید */
export function newSessionExpiry(isAdminSession: boolean, now = new Date()): Date {
  const ttl = isAdminSession
    ? SESSION_POLICY.admin.absoluteTtlMs
    : SESSION_POLICY.customer.absoluteTtlMs;
  return new Date(now.getTime() + ttl);
}

/** آیا session ادمین بر اثر idle منقضی شده؟ */
export function isIdleExpired(idleAt: Date | null, now = new Date()): boolean {
  if (!idleAt) return false;
  return now.getTime() - idleAt.getTime() > SESSION_POLICY.admin.idleTimeoutMs;
}

/** آیا session معتبر است؟ (revocation + انقضای مطلق + idle) */
export function isSessionValid(
  s: { expiresAt: Date; revokedAt: Date | null; isAdminSession: boolean; idleAt: Date | null },
  now = new Date(),
): boolean {
  if (s.revokedAt) return false;
  if (s.expiresAt.getTime() <= now.getTime()) return false;
  if (s.isAdminSession && isIdleExpired(s.idleAt, now)) return false;
  return true;
}
