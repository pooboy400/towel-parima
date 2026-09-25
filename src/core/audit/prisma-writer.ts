/**
 * PrismaAuditWriter — پیاده‌سازی M2 قرارداد AuditWriter (بخش ۲۰ سند)
 * ---------------------------------------------------------------
 * - append-only: فقط create — هیچ update/delete وجود ندارد (حتی SUPER_ADMIN)
 * - fire-safe: خطای دیتابیس هرگز جریان اصلی mutation را نمی‌شکند
 * - داده حساس (رمز/توکن) هرگز در before/after نیست — مسئولیت فراخواننده + اینجا هم trim
 */

import "server-only";
import { db } from "@/lib/db";
import type { AuditWriter } from "./index";
import type { AuditInput } from "./index";

/** فیلدهایی که هرگز نباید در before/after بنشینند */
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "newPassword",
  "currentPassword",
  "token",
  "sessionToken",
  "codeHash",
  "totpSecret",
]);

function scrub(record: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!record) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = v;
  }
  return out;
}

export class PrismaAuditWriter implements AuditWriter {
  async append(entry: AuditInput): Promise<void> {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action.slice(0, 100),
        entityType: entry.entityType.slice(0, 50),
        entityId: entry.entityId,
        before: scrub(entry.before) === null ? undefined : (scrub(entry.before) as object),
        after: scrub(entry.after) === null ? undefined : (scrub(entry.after) as object),
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 300) ?? null,
      },
    });
  }
}
