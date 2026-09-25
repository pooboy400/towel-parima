/**
 * Journal Admin Actions — ایجاد/ویرایش/انتشار مقاله (CONTENT_TRANSITIONS §M0)
 * گذار وضعیت: DRAFT→PUBLISHED / PUBLISHED→ARCHIVED / ARCHIVED→DRAFT — فقط
 * گذارهای جدول CONTENT_TRANSITIONS؛ گذار غیرمجاز = INVALID_TRANSITION 409.
 */

"use server";

import { revalidateEntityTag, CACHE_TAGS } from "@/core/cache";
import { db } from "@/lib/db";
import { safeAudit } from "@/core/audit";
import { DomainError } from "@/core/errors";
import { PERMISSIONS } from "@/core/auth/permissions";
import { CONTENT_TRANSITIONS, checkTransition } from "@/domain/state-machines";
import { z } from "zod";
import { withAdminAction, requestMeta, type ActionResult } from "@/lib/admin/action-helpers";

const journalUpsertSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "عنوان حداقل ۳ نویسه است.").max(150),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "اسلاگ فقط حروف انگلیسی کوچک، عدد و خط تیره."),
  excerpt: z.string().trim().min(10, "خلاصه حداقل ۱۰ نویسه است.").max(500),
  bodyMarkdown: z.string().trim().min(20, "متن مقاله حداقل ۲۰ نویسه است.").max(50_000),
  coverKey: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export type JournalUpsertResult = { id: string; slug: string };

function invalidateJournal(slug: string) {
  revalidateEntityTag(CACHE_TAGS.journal);
  revalidateEntityTag(CACHE_TAGS.journalPost(slug));
  revalidateEntityTag(CACHE_TAGS.homepage);
  revalidateEntityTag(CACHE_TAGS.content);
}

export async function upsertJournalAction(
  input: unknown,
): Promise<ActionResult<JournalUpsertResult>> {
  return withAdminAction(PERMISSIONS.contentUpdate, async (ctx) => {
    const parsed = journalUpsertSchema.parse(input);
    const meta = await requestMeta();

    const slugTaken = await db.journalPost.findFirst({
      where: { slug: parsed.slug, ...(parsed.id ? { id: { not: parsed.id } } : {}) },
      select: { id: true },
    });
    if (slugTaken) throw new DomainError("CONFLICT", "این اسلاگ برای مقاله دیگری استفاده شده است.");

    const result = await db.$transaction(async (tx) => {
      if (parsed.id) {
        const existing = await tx.journalPost.findUnique({ where: { id: parsed.id } });
        if (!existing) throw new DomainError("NOT_FOUND", "مقاله یافت نشد.");

        // گذار وضعیت فقط طبق جدول ماشین حالت
        if (existing.status !== parsed.status) {
          const check = checkTransition(
            CONTENT_TRANSITIONS,
            existing.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
            parsed.status,
          );
          if (!check.allowed) {
            throw new DomainError(
              "INVALID_TRANSITION",
              `گذار وضعیت مقاله از ${existing.status} به ${parsed.status} مجاز نیست.`,
            );
          }
        }

        await tx.journalPost.update({
          where: { id: parsed.id },
          data: {
            title: parsed.title,
            readingMinutes: Math.max(1, Math.ceil(parsed.bodyMarkdown.split(/\s+/).length / 180)),
            slug: parsed.slug,
            excerpt: parsed.excerpt,
            bodyMarkdown: parsed.bodyMarkdown,
            coverKey: parsed.coverKey || null,
            status: parsed.status,
            publishedAt:
              parsed.status === "PUBLISHED" && !existing.publishedAt ? new Date() : existing.publishedAt,
          },
        });
        await safeAudit({
          actorId: ctx.actor.userId,
          action: "journal.update",
          entityType: "journal",
          entityId: parsed.id,
          before: { title: existing.title, slug: existing.slug, status: existing.status },
          after: { title: parsed.title, slug: parsed.slug, status: parsed.status },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        invalidateJournal(existing.slug);
        return { id: parsed.id, slug: parsed.slug };
      }

      const created = await tx.journalPost.create({
        data: {
          title: parsed.title,
          slug: parsed.slug,
          excerpt: parsed.excerpt,
          bodyMarkdown: parsed.bodyMarkdown,
          coverKey: parsed.coverKey || null,
          status: parsed.status,
          topic: "راهنمای خرید",
          readingMinutes: Math.max(1, Math.ceil(parsed.bodyMarkdown.split(/\s+/).length / 180)),
          publishedAt: parsed.status === "PUBLISHED" ? new Date() : null,
        },
      });
      await safeAudit({
        actorId: ctx.actor.userId,
        action: "journal.create",
        entityType: "journal",
        entityId: created.id,
        after: { title: parsed.title, slug: parsed.slug, status: parsed.status },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      invalidateJournal(parsed.slug);
      return { id: created.id, slug: created.slug };
    });

    return result;
  });
}

export async function deleteJournalAction(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.contentUpdate, async (ctx) => {
    const existing = await db.journalPost.findUnique({ where: { id: input.id } });
    if (!existing) throw new DomainError("NOT_FOUND", "مقاله یافت نشد.");
    const meta = await requestMeta();
    await db.journalPost.delete({ where: { id: input.id } });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "journal.delete",
      entityType: "journal",
      entityId: input.id,
      before: { title: existing.title, slug: existing.slug },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    invalidateJournal(existing.slug);
    return { id: input.id };
  });
}
