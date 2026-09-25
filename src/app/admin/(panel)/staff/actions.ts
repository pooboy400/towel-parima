"use server";

/**
 * Staff + Account Actions — مدیریت کارکنان و حساب (M2)
 * ---------------------------------------------------------------
 * - ایجاد کارمند با نقش (users.create/update §6)
 * - غیرفعال‌سازی → revoke اجباری همه نشست‌ها (§9.3)
 * - reset رمز → revoke اجباری + audit
 * - تغییر رمز خودی: تأیید رمز فعلی + revoke نشست‌های دیگر دستگاه‌ها
 */

import { revalidateEntityTag, CACHE_TAGS } from "@/core/cache";
import { db } from "@/lib/db";
import { safeAudit } from "@/core/audit";
import { DomainError } from "@/core/errors";
import { PERMISSIONS } from "@/core/auth/permissions";
import { hashPassword, verifyPassword } from "@/core/auth/password";
import { revokeAllSessionsForUser } from "@/core/auth/session-service";
import {
  staffCreateSchema,
  changePasswordSchema,
} from "@/domain/schemas/admin";
import { withAdminAction, requestMeta, type ActionResult } from "@/lib/admin/action-helpers";

export async function createStaffAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.usersUpdate, async (ctx) => {
    const parsed = staffCreateSchema.parse(input);
    const meta = await requestMeta();

    const emailTaken = await db.user.findUnique({ where: { email: parsed.email }, select: { id: true } });
    if (emailTaken) throw new DomainError("CONFLICT", "این ایمیل قبلاً ثبت شده است.");
    const phoneTaken = await db.user.findUnique({ where: { phone: parsed.phone }, select: { id: true } });
    if (phoneTaken) throw new DomainError("CONFLICT", "این شماره موبایل قبلاً ثبت شده است.");

    const role = await db.role.findUnique({ where: { name: parsed.roleName } });
    if (!role) throw new DomainError("VALIDATION_ERROR", "نقش انتخاب‌شده معتبر نیست.");

    const created = await db.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        passwordHash: await hashPassword(parsed.password),
        roleId: role.id,
        isActive: true,
      },
      select: { id: true },
    });

    await safeAudit({
      actorId: ctx.actor.userId,
      action: "user.create",
      entityType: "user",
      entityId: created.id,
      after: { name: parsed.name, email: parsed.email, role: parsed.roleName },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidateEntityTag(CACHE_TAGS.settings);
    return { id: created.id };
  });
}

export async function setUserActiveAction(input: {
  id: string;
  isActive: boolean;
}): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.usersUpdate, async (ctx) => {
    if (input.id === ctx.actor.userId && !input.isActive) {
      throw new DomainError("VALIDATION_ERROR", "خودتان را نمی‌توانید غیرفعال کنید.");
    }
    const user = await db.user.findFirst({
      where: { id: input.id, deletedAt: null },
      include: { role: true },
    });
    if (!user) throw new DomainError("NOT_FOUND", "کاربر یافت نشد.");

    const meta = await requestMeta();
    await db.user.update({ where: { id: input.id }, data: { isActive: input.isActive } });
    // غیرفعال‌سازی = اخراج فوری از همه نشست‌های فعال (§9.3)
    if (!input.isActive) await revokeAllSessionsForUser(input.id);

    await safeAudit({
      actorId: ctx.actor.userId,
      action: "user.status.update",
      entityType: "user",
      entityId: input.id,
      before: { isActive: user.isActive },
      after: { isActive: input.isActive },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id: input.id };
  });
}

export async function resetStaffPasswordAction(input: {
  id: string;
  newPassword: string;
}): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.usersUpdate, async (ctx) => {
    if (input.newPassword.length < 10) {
      throw new DomainError("VALIDATION_ERROR", "رمز جدید حداقل ۱۰ کاراکتر است.");
    }
    const user = await db.user.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!user) throw new DomainError("NOT_FOUND", "کاربر یافت نشد.");

    const meta = await requestMeta();
    await db.user.update({
      where: { id: input.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    // reset رمز = revoke اجباری همه نشست‌ها (§9.3)
    await revokeAllSessionsForUser(input.id);
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "user.password.reset",
      entityType: "user",
      entityId: input.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id: input.id };
  });
}

/** تغییر رمز توسط خود کاربر — نیاز به رمز فعلی */
export async function changeOwnPasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult<{ saved: true }>> {
  return withAdminAction(PERMISSIONS.settingsRead, async (ctx) => {
    const parsed = changePasswordSchema.parse(input);
    const user = await db.user.findUnique({ where: { id: ctx.actor.userId } });
    if (!user?.passwordHash) throw new DomainError("UNAUTHENTICATED", "حساب شما رمز ندارد.");

    const ok = await verifyPassword(parsed.currentPassword, user.passwordHash);
    if (!ok) throw new DomainError("VALIDATION_ERROR", "رمز فعلی اشتباه است.");
    if (parsed.currentPassword === parsed.newPassword) {
      throw new DomainError("VALIDATION_ERROR", "رمز جدید نباید با رمز فعلی یکسان باشد.");
    }

    const meta = await requestMeta();
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.newPassword) },
    });
    // همه نشست‌های دیگر دستگاه‌ها باطل می‌شوند — نشست جاری حفظ می‌شود
    await revokeAllSessionsForUser(user.id, ctx.session.id);
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "user.password.change",
      entityType: "user",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { saved: true };
  });
}
