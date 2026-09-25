"use server";

/**
 * FAQ + Review Moderation + Settings Actions — محتوا (M2)
 */

import { revalidateEntityTag, CACHE_TAGS } from "@/core/cache";
import { db } from "@/lib/db";
import { safeAudit } from "@/core/audit";
import { DomainError } from "@/core/errors";
import { PERMISSIONS } from "@/core/auth/permissions";
import { REVIEW_TRANSITIONS, checkTransition } from "@/domain/state-machines";
import { storeConfigSchema, shippingInfoSchema, testimonialSchema, homeSettingsSchema, badgeRulesSchema } from "@/domain/schemas/settings";
import { z } from "zod";
import { withAdminAction, requestMeta, type ActionResult } from "@/lib/admin/action-helpers";
import { Prisma } from "@prisma/client";

/** cast امن به InputJsonValue برای ستون Json پرisma */
const json = (v: unknown) => v as Prisma.InputJsonValue;

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

const faqUpsertSchema = z.object({
  id: z.string().optional(),
  question: z.string().trim().min(3, "سوال حداقل ۳ نویسه است.").max(300),
  answer: z.string().trim().min(3, "پاسخ حداقل ۳ نویسه است.").max(3000),
  sortOrder: z.number().int().min(0).default(0),
});

function invalidateContent() {
  revalidateEntityTag(CACHE_TAGS.content);
  revalidateEntityTag(CACHE_TAGS.homepage);
}

export async function upsertFaqAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.contentUpdate, async (ctx) => {
    const parsed = faqUpsertSchema.parse(input);
    const meta = await requestMeta();
    const id = await db.$transaction(async (tx) => {
      if (parsed.id) {
        const existing = await tx.faqItem.findUnique({ where: { id: parsed.id } });
        if (!existing) throw new DomainError("NOT_FOUND", "سوال یافت نشد.");
        await tx.faqItem.update({
          where: { id: parsed.id },
          data: { question: parsed.question, answer: parsed.answer, sortOrder: parsed.sortOrder },
        });
        await safeAudit({
          actorId: ctx.actor.userId,
          action: "faq.update",
          entityType: "faq",
          entityId: parsed.id,
          before: { question: existing.question },
          after: { question: parsed.question },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        return parsed.id;
      }
      const created = await tx.faqItem.create({
        data: { question: parsed.question, answer: parsed.answer, sortOrder: parsed.sortOrder },
      });
      await safeAudit({
        actorId: ctx.actor.userId,
        action: "faq.create",
        entityType: "faq",
        entityId: created.id,
        after: { question: parsed.question },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return created.id;
    });
    invalidateContent();
    return { id };
  });
}

export async function deleteFaqAction(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.contentUpdate, async (ctx) => {
    const existing = await db.faqItem.findUnique({ where: { id: input.id } });
    if (!existing) throw new DomainError("NOT_FOUND", "سوال یافت نشد.");
    const meta = await requestMeta();
    await db.faqItem.delete({ where: { id: input.id } });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "faq.delete",
      entityType: "faq",
      entityId: input.id,
      before: { question: existing.question },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    invalidateContent();
    return { id: input.id };
  });
}

/* ------------------------------------------------------------------ */
/* نظرها — تأیید/رد با ماشین حالت REVIEW_TRANSITIONS                    */
/* ------------------------------------------------------------------ */

export async function moderateReviewAction(input: {
  id: string;
  decision: "APPROVED" | "REJECTED";
}): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.reviewsModerate, async (ctx) => {
    const review = await db.review.findUnique({ where: { id: input.id } });
    if (!review) throw new DomainError("NOT_FOUND", "نظر یافت نشد.");

    const check = checkTransition(REVIEW_TRANSITIONS, review.status, input.decision);
    if (!check.allowed) {
      throw new DomainError(
        "INVALID_TRANSITION",
        `گذار وضعیت نظر از ${review.status} به ${input.decision} مجاز نیست.`,
      );
    }

    const meta = await requestMeta();
    await db.review.update({ where: { id: review.id }, data: { status: input.decision } });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "review.moderate",
      entityType: "review",
      entityId: review.id,
      before: { status: review.status },
      after: { status: input.decision },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidateEntityTag(CACHE_TAGS.reviews(review.productId));
    revalidateEntityTag(CACHE_TAGS.products);
    revalidateEntityTag(CACHE_TAGS.homepage);
    return { id: review.id };
  });
}

/* ------------------------------------------------------------------ */
/* تنظیمات — settings.update + audit اجباری (§20)                       */
/* ------------------------------------------------------------------ */

export async function updateStoreConfigAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return withAdminAction(PERMISSIONS.settingsUpdate, async (ctx) => {
    const parsed = storeConfigSchema.parse(input);
    const meta = await requestMeta();
    const before = (await db.setting.findUnique({ where: { key: "store.config" } }))?.value as Record<string, unknown> | null;
    await db.setting.upsert({
      where: { key: "store.config" },
      update: { value: json(parsed), updatedBy: ctx.actor.userId },
      create: { key: "store.config", value: json(parsed), updatedBy: ctx.actor.userId },
    });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "settings.update",
      entityType: "setting",
      entityId: "store.config",
      before: before ?? null,
      after: parsed as Record<string, unknown>,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidateEntityTag(CACHE_TAGS.settings);
    revalidateEntityTag(CACHE_TAGS.homepage);
    return { saved: true };
  });
}

export async function updateShippingAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return withAdminAction(PERMISSIONS.settingsUpdate, async (ctx) => {
    const parsed = shippingInfoSchema.parse(input);
    const meta = await requestMeta();
    const before = (await db.setting.findUnique({ where: { key: "store.shipping" } }))?.value as Record<string, unknown> | null;
    await db.setting.upsert({
      where: { key: "store.shipping" },
      update: { value: json(parsed), updatedBy: ctx.actor.userId },
      create: { key: "store.shipping", value: json(parsed), updatedBy: ctx.actor.userId },
    });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "settings.update",
      entityType: "setting",
      entityId: "store.shipping",
      before: before ?? null,
      after: parsed as Record<string, unknown>,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidateEntityTag(CACHE_TAGS.settings);
    return { saved: true };
  });
}

export async function updateTestimonialsAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return withAdminAction(PERMISSIONS.settingsUpdate, async (ctx) => {
    const parsed = z.object({ items: z.array(testimonialSchema).max(12) }).parse(input);
    const meta = await requestMeta();
    const before = (await db.setting.findUnique({ where: { key: "home.testimonials" } }))?.value as Record<string, unknown> | null;
    await db.setting.upsert({
      where: { key: "home.testimonials" },
      update: { value: json(parsed), updatedBy: ctx.actor.userId },
      create: { key: "home.testimonials", value: json(parsed), updatedBy: ctx.actor.userId },
    });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "settings.update",
      entityType: "setting",
      entityId: "home.testimonials",
      before: before ?? null,
      after: { count: parsed.items.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidateEntityTag(CACHE_TAGS.settings);
    revalidateEntityTag(CACHE_TAGS.homepage);
    return { saved: true };
  });
}

/** کالکشن ویژهٔ صفحهٔ اصلی (home.featured) — به‌جای اسلاگ ثابت "spa" در کد */
export async function updateHomeFeaturedAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return withAdminAction(PERMISSIONS.settingsUpdate, async (ctx) => {
    const parsed = homeSettingsSchema.parse(input);
    const meta = await requestMeta();
    const before = (await db.setting.findUnique({ where: { key: "home.featured" } }))?.value as Record<string, unknown> | null;
    await db.setting.upsert({
      where: { key: "home.featured" },
      update: { value: json(parsed), updatedBy: ctx.actor.userId },
      create: { key: "home.featured", value: json(parsed), updatedBy: ctx.actor.userId },
    });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "settings.update",
      entityType: "setting",
      entityId: "home.featured",
      before: before ?? null,
      after: parsed as Record<string, unknown>,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidateEntityTag(CACHE_TAGS.settings);
    revalidateEntityTag(CACHE_TAGS.homepage);
    return { saved: true };
  });
}

/**
 * قوانین برچسب‌های خودکار (store.badgeRules) — ADR 011.
 * تغییر آستانه‌ها روی برچسب‌های ویترین اثر دارد → علاوه بر settings،
 * تگ محصولات و صفحهٔ اصلی هم invalidate می‌شود.
 */
export async function updateBadgeRulesAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  return withAdminAction(PERMISSIONS.settingsUpdate, async (ctx) => {
    const parsed = badgeRulesSchema.parse(input);
    const meta = await requestMeta();
    const before = (await db.setting.findUnique({ where: { key: "store.badgeRules" } }))?.value as Record<string, unknown> | null;
    await db.setting.upsert({
      where: { key: "store.badgeRules" },
      update: { value: json(parsed), updatedBy: ctx.actor.userId },
      create: { key: "store.badgeRules", value: json(parsed), updatedBy: ctx.actor.userId },
    });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "settings.update",
      entityType: "setting",
      entityId: "store.badgeRules",
      before: before ?? null,
      after: parsed as Record<string, unknown>,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidateEntityTag(CACHE_TAGS.settings);
    revalidateEntityTag(CACHE_TAGS.products);
    revalidateEntityTag(CACHE_TAGS.homepage);
    return { saved: true };
  });
}
