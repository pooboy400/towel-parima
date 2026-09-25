/**
 * Audit — قرارداد append-only (بخش ۲۰ سند معماری)
 * ---------------------------------------------------------------
 * M0: قرارداد + ثبت‌کننده خنثی (log) تا تایپ‌ها و جریان فراخوانی قفل شود.
 * M2: پیاده‌سازی DB وصل می‌شود — AuditWriter امضا ثابت.
 *
 * ⚠️ هیچ update/delete روی AuditLog — حتی SUPER_ADMIN.
 * داده حساس (رمز/توکن/شماره کارت) هرگز در before/after نمی‌آید.
 */

import type { AuditLogEntry } from "@/domain/models/system";
import { newRequestId } from "../errors";
import { PrismaAuditWriter } from "./prisma-writer";

export interface AuditWriter {
  /** append یک رخداد — هرگز خطای audit نباید جریان اصلی را بشکند (fire-safe) */
  append(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<void>;
}

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * پیاده‌سازی M0 — لاگ JSON ساخت‌یافته.
 * در M2 با همان امضا به AuditService دیتابیسی تبدیل می‌شود.
 */
export class ConsoleAuditWriter implements AuditWriter {
  async append(entry: AuditInput): Promise<void> {
    const record = {
      level: "audit",
      ts: new Date().toISOString(),
      requestId: newRequestId(),
      ...entry,
    };
    console.log(JSON.stringify(record));
  }
}

/** نمونه سرور — M2: نویسنده دیتابیسی (همان امضای M0) */
export const auditWriter: AuditWriter = new PrismaAuditWriter();

/** helper امن — خطای audit هرگز mutation اصلی را fail نمی‌کند */
export async function safeAudit(input: AuditInput): Promise<void> {
  try {
    await auditWriter.append(input);
  } catch (e) {
    console.error(
      JSON.stringify({ level: "error", type: "audit_write_failed", message: String(e) }),
    );
  }
}
