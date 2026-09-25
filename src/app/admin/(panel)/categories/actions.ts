/**
 * Category + Collection Admin Actions — CRUD کاتالوگ (بخش ۸ سند)
 * زنجیره استاندارد: guard → Zod → قواعد (یکتایی slug، قید FK) → tx → audit → invalidation
 */

"use server";

import { revalidateEntityTag, CACHE_TAGS } from "@/core/cache";
import { db } from "@/lib/db";
import { safeAudit } from "@/core/audit";
import { DomainError } from "@/core/errors";
import { PERMISSIONS } from "@/core/auth/permissions";
import {
  categoryUpsertSchema,
  collectionUpsertSchema,
  type CategoryUpsertInput,
  type CollectionUpsertInput,
} from "@/domain/schemas/admin";
import { withAdminAction, requestMeta, type ActionResult } from "@/lib/admin/action-helpers";

type ActionOf<T> = ActionResult<T>;

/* ------------------------------------------------------------------ */
/* دسته‌بندی‌ها                                                        */
/* ------------------------------------------------------------------ */

function invalidateCategory(slug?: string) {
  if (slug) revalidateEntityTag(CACHE_TAGS.category(slug));
  revalidateEntityTag(CACHE_TAGS.products);
  revalidateEntityTag(CACHE_TAGS.homepage);
  revalidateEntityTag(CACHE_TAGS.content);
}

export async function upsertCategoryAction(
  input: unknown,
): Promise<ActionOf<CategoryUpsertInput & { id: string }>> {
  return withAdminAction(PERMISSIONS.productsUpdate, async (ctx) => {
    const parsed = categoryUpsertSchema.parse(input);
    const meta = await requestMeta();

    const slugTaken = await db.category.findFirst({
      where: { slug: parsed.slug, ...(parsed.id ? { id: { not: parsed.id } } : {}) },
      select: { id: true, slug: true },
    });
    if (slugTaken) throw new DomainError("CONFLICT", "این اسلاگ برای دسته دیگری استفاده شده است.");

    const result = await db.$transaction(async (tx) => {
      if (parsed.id) {
        const existing = await tx.category.findUnique({ where: { id: parsed.id } });
        if (!existing) throw new DomainError("NOT_FOUND", "دسته‌بندی یافت نشد.");
        await tx.category.update({
          where: { id: parsed.id },
          data: {
            name: parsed.name,
            slug: parsed.slug,
            description: parsed.description || null,
            seoText: parsed.seoText || null,
            imageKey: parsed.imageKey || null,
            sortOrder: parsed.sortOrder,
          },
        });
        await safeAudit({
          actorId: ctx.actor.userId,
          action: "category.update",
          entityType: "category",
          entityId: parsed.id,
          before: { name: existing.name, slug: existing.slug, sortOrder: existing.sortOrder },
          after: { name: parsed.name, slug: parsed.slug, sortOrder: parsed.sortOrder },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        invalidateCategory(parsed.slug);
        invalidateCategory(existing.slug);
        return { ...parsed, id: parsed.id };
      }

      const created = await tx.category.create({
        data: {
          name: parsed.name,
          slug: parsed.slug,
          description: parsed.description || null,
          seoText: parsed.seoText || null,
          imageKey: parsed.imageKey || null,
          sortOrder: parsed.sortOrder,
        },
      });
      await safeAudit({
        actorId: ctx.actor.userId,
        action: "category.create",
        entityType: "category",
        entityId: created.id,
        after: { name: parsed.name, slug: parsed.slug },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      invalidateCategory(parsed.slug);
      return { ...parsed, id: created.id };
    });

    return result;
  });
}

export async function deleteCategoryAction(input: { id: string }): Promise<ActionOf<{ id: string }>> {
  return withAdminAction(PERMISSIONS.productsDelete, async (ctx) => {
    const existing = await db.category.findUnique({
      where: { id: input.id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) throw new DomainError("NOT_FOUND", "دسته‌بندی یافت نشد.");
    if (existing._count.products > 0) {
      throw new DomainError(
        "CONFLICT",
        `${existing._count.products} محصول به این دسته وصل است. اول محصولات را جابه‌جا کنید.`,
      );
    }
    const meta = await requestMeta();
    await db.category.delete({ where: { id: input.id } });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "category.delete",
      entityType: "category",
      entityId: input.id,
      before: { name: existing.name, slug: existing.slug },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    invalidateCategory(existing.slug);
    return { id: input.id };
  });
}

/* ------------------------------------------------------------------ */
/* کالکشن‌ها                                                           */
/* ------------------------------------------------------------------ */

function invalidateCollection(slug?: string) {
  if (slug) revalidateEntityTag(CACHE_TAGS.collection(slug));
  revalidateEntityTag(CACHE_TAGS.products);
  revalidateEntityTag(CACHE_TAGS.homepage);
}

export async function upsertCollectionAction(
  input: unknown,
): Promise<ActionOf<CollectionUpsertInput & { id: string }>> {
  return withAdminAction(PERMISSIONS.productsUpdate, async (ctx) => {
    const parsed = collectionUpsertSchema.parse(input);
    const meta = await requestMeta();

    const slugTaken = await db.collection.findFirst({
      where: { slug: parsed.slug, ...(parsed.id ? { id: { not: parsed.id } } : {}) },
      select: { id: true, slug: true },
    });
    if (slugTaken) throw new DomainError("CONFLICT", "این اسلاگ برای کالکشن دیگری استفاده شده است.");

    const result = await db.$transaction(async (tx) => {
      if (parsed.id) {
        const existing = await tx.collection.findUnique({ where: { id: parsed.id } });
        if (!existing) throw new DomainError("NOT_FOUND", "کالکشن یافت نشد.");

        await tx.collection.update({
          where: { id: parsed.id },
          data: {
            name: parsed.name,
            slug: parsed.slug,
            description: parsed.description || null,
            imageKey: parsed.imageKey || null,
            sortOrder: parsed.sortOrder,
          },
        });
        await tx.collectionProduct.deleteMany({ where: { collectionId: parsed.id } });
        if (parsed.productIds.length) {
          await tx.collectionProduct.createMany({
            data: parsed.productIds.map((pid) => ({ collectionId: parsed.id!, productId: pid })),
          });
        }
        await safeAudit({
          actorId: ctx.actor.userId,
          action: "collection.update",
          entityType: "collection",
          entityId: parsed.id,
          before: { name: existing.name, slug: existing.slug },
          after: { name: parsed.name, slug: parsed.slug, products: parsed.productIds.length },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        invalidateCollection(parsed.slug);
        invalidateCollection(existing.slug);
        return { ...parsed, id: parsed.id };
      }

      const created = await tx.collection.create({
        data: {
          name: parsed.name,
          slug: parsed.slug,
          description: parsed.description || null,
          imageKey: parsed.imageKey || null,
          sortOrder: parsed.sortOrder,
        },
      });
      if (parsed.productIds.length) {
        await tx.collectionProduct.createMany({
          data: parsed.productIds.map((pid) => ({ collectionId: created.id, productId: pid })),
        });
      }
      await safeAudit({
        actorId: ctx.actor.userId,
        action: "collection.create",
        entityType: "collection",
        entityId: created.id,
        after: { name: parsed.name, slug: parsed.slug },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      invalidateCollection(parsed.slug);
      return { ...parsed, id: created.id };
    });

    return result;
  });
}

export async function deleteCollectionAction(input: { id: string }): Promise<ActionOf<{ id: string }>> {
  return withAdminAction(PERMISSIONS.productsDelete, async (ctx) => {
    const existing = await db.collection.findUnique({ where: { id: input.id } });
    if (!existing) throw new DomainError("NOT_FOUND", "کالکشن یافت نشد.");
    const meta = await requestMeta();
    await db.collection.delete({ where: { id: input.id } });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "collection.delete",
      entityType: "collection",
      entityId: input.id,
      before: { name: existing.name, slug: existing.slug },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    invalidateCollection(existing.slug);
    return { id: input.id };
  });
}
