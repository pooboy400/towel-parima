"use server";

/**
 * Messages Actions — خوانده‌شده/حذف پیام‌های تماس و خبرنامه (ADR 009)
 * امنیت: requirePermission(content.update) در هر اکشن + audit.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAudit } from "@/core/audit";
import { DomainError } from "@/core/errors";
import { PERMISSIONS } from "@/core/auth/permissions";
import { withAdminAction, requestMeta, type ActionResult } from "@/lib/admin/action-helpers";

export async function markMessageReadAction(id: string): Promise<ActionResult<{ saved: true }>> {
  return withAdminAction(PERMISSIONS.contentUpdate, async (ctx) => {
    const meta = await requestMeta();
    const row = await db.contactMessage.findUnique({ where: { id } });
    if (!row) throw new DomainError("NOT_FOUND", "پیام یافت نشد.");
    await db.contactMessage.update({ where: { id }, data: { status: "READ" } });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "message.update",
      entityType: "contactMessage",
      entityId: id,
      before: { status: row.status },
      after: { status: "READ" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidatePath("/admin/messages");
    return { saved: true };
  });
}

export async function deleteMessageAction(id: string): Promise<ActionResult<{ saved: true }>> {
  return withAdminAction(PERMISSIONS.contentUpdate, async (ctx) => {
    const meta = await requestMeta();
    const row = await db.contactMessage.findUnique({ where: { id } });
    if (!row) throw new DomainError("NOT_FOUND", "پیام یافت نشد.");
    await db.contactMessage.delete({ where: { id } });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "message.delete",
      entityType: "contactMessage",
      entityId: id,
      before: { kind: row.kind, email: row.email },
      after: null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidatePath("/admin/messages");
    return { saved: true };
  });
}
