/**
 * Product Admin Actions — ایجاد/ویرایش/آرشیو/تنظیم موجودی (بخش ۸ سند)
 * ---------------------------------------------------------------
 * زنجیره: requirePermission → Zod → قواعد (slug/sku یکتا) → tx → audit → revalidateTag
 * تراکنش: محصول + تصاویر + واریانت‌ها + پیوندهای کالکشن یکجا.
 * قاعده حذف واریانت: اگر رزرو فعال داشته باشد (M3+) هرگز حذف نمی‌شود.
 */

"use server";

import { db } from "@/lib/db";
import { safeAudit } from "@/core/audit";
import { CACHE_TAGS, productInvalidationTags, revalidateEntityTag } from "@/core/cache";
import { DomainError } from "@/core/errors";
import { PERMISSIONS } from "@/core/auth/permissions";
import { productUpsertSchema, type ProductUpsertInput } from "@/domain/schemas/admin";
import { buildProductSearchKey } from "@/lib/repositories/mappers";
import { withAdminAction, requestMeta, type ActionResult } from "@/lib/admin/action-helpers";
import { z } from "zod";

/** invalidation استاندارد محصول (§16.1) */
function invalidateProduct(productId: string) {
  for (const tag of productInvalidationTags(productId, { onHomepage: true })) {
    revalidateEntityTag(tag);
  }
  revalidateEntityTag(CACHE_TAGS.products);
}

function assertUniqueSkus(input: ProductUpsertInput) {
  const skus = input.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) {
    throw new DomainError("VALIDATION_ERROR", "کدهای SKU تکراری هستند — هر واریانت باید کد یکتا داشته باشد.");
  }
}

export async function upsertProductAction(
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string; created: boolean }>> {
  return withAdminAction(PERMISSIONS.productsUpdate, async (ctx) => {
    const parsed = productUpsertSchema.parse(input);
    assertUniqueSkus(parsed);

    // ── دسترسی دقیق: ایجاد با create، بقیه با update
    if (!parsed.id) {
      if (!ctx.actor.permissions.includes(PERMISSIONS.productsCreate)) {
        throw new DomainError("FORBIDDEN", "شما به ایجاد محصول دسترسی ندارید.");
      }
    }

    const categoryExists = await db.category.findFirst({
      where: { id: parsed.categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!categoryExists) throw new DomainError("VALIDATION_ERROR", "دسته‌بندی انتخاب‌شده معتبر نیست.");

    // ── یکتایی slug
    const slugTaken = await db.product.findFirst({
      where: { slug: parsed.slug, deletedAt: null, ...(parsed.id ? { id: { not: parsed.id } } : {}) },
      select: { id: true },
    });
    if (slugTaken) throw new DomainError("CONFLICT", "این اسلاگ قبلاً استفاده شده است.");

    const searchKey = buildProductSearchKey(
      parsed.name,
      parsed.shortDescription || "",
      parsed.description || "",
      "",
    );

    const meta = await requestMeta();
    const result = await db.$transaction(async (tx) => {
      let productId = parsed.id ?? "";

      if (parsed.id) {
        const existing = await tx.product.findFirst({
          where: { id: parsed.id!, deletedAt: null },
          include: {
            variants: { where: { deletedAt: null } },
            images: true,
            collections: true,
          },
        });
        if (!existing) throw new DomainError("NOT_FOUND", "محصول یافت نشد.");

        // واریانت‌هایی که از فرم حذف شده‌اند — soft-delete امن
        const keepIds = new Set(parsed.variants.filter((v) => v.id).map((v) => v.id!));
        const removed = existing.variants.filter((v) => !keepIds.has(v.id));
        for (const v of removed) {
          const activeReservation = await tx.inventoryReservation.findFirst({
            where: { variantId: v.id, status: "ACTIVE" },
            select: { id: true },
          });
          if (activeReservation) {
            throw new DomainError(
              "CONFLICT",
              "واریانتی با رزرو فعال قابل حذف نیست. ابتدا رزرو را مدیریت کنید.",
            );
          }
        }

        await tx.product.update({
          where: { id: productId },
          data: {
            name: parsed.name,
            slug: parsed.slug,
            categoryId: parsed.categoryId,
            shortDescription: parsed.shortDescription || "",
            description: parsed.description || "",
            status: parsed.status,
            specs: parsed.specs,
            care: parsed.care,
            suitableFor: parsed.suitableFor,
            features: parsed.features,
            sortOrder: parsed.sortOrder,
            searchKey,
          },
        });

        // واریانت‌ها: به‌روزرسانی/ایجاد/حذف نرم
        for (const [i, v] of parsed.variants.entries()) {
          const variantData = {
            sku: v.sku,
            price: v.price,
            compareAtPrice: v.compareAtPrice ?? null,
            stock: v.stock,
            colorId: v.colorId || null,
            sizeId: v.sizeId || null,
            isActive: v.isActive,
            sortOrder: i,
          };
          if (v.id) {
            await tx.variant.update({ where: { id: v.id }, data: variantData });
          } else {
            await tx.variant.create({ data: { productId, ...variantData } });
          }
        }
        if (removed.length) {
          await tx.variant.updateMany({
            where: { id: { in: removed.map((v) => v.id) } },
            data: { deletedAt: new Date(), isActive: false },
          });
        }

        // تصاویر — بازنویسی کامل با حفظ ترتیب فرم
        await tx.productImage.deleteMany({ where: { productId } });
        if (parsed.images.length) {
          await tx.productImage.createMany({
            data: parsed.images.map((img, i) => ({
              productId,
              storageKey: img.storageKey,
              alt: img.alt ?? null,
              sortOrder: i,
            })),
          });
        }

        // کالکشن‌ها
        await tx.collectionProduct.deleteMany({ where: { productId } });
        if (parsed.collectionIds.length) {
          await tx.collectionProduct.createMany({
            data: parsed.collectionIds.map((cid) => ({ productId, collectionId: cid })),
          });
        }

        await safeAudit({
          actorId: ctx.actor.userId,
          action: "product.update",
          entityType: "product",
          entityId: productId,
          before: {
            name: existing.name,
            slug: existing.slug,
            status: existing.status,
            categoryId: existing.categoryId,
            variants: existing.variants.map((v) => ({ sku: v.sku, price: v.price, stock: v.stock })),
          },
          after: {
            name: parsed.name,
            slug: parsed.slug,
            status: parsed.status,
            categoryId: parsed.categoryId,
            variants: parsed.variants.map((v) => ({ sku: v.sku, price: v.price, stock: v.stock })),
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });

        return { id: productId, slug: parsed.slug, created: false };
      }

      // ── ایجاد محصول جدید + واریانت‌ها
      const created = await tx.product.create({
        data: {
          name: parsed.name,
          slug: parsed.slug,
          categoryId: parsed.categoryId,
          shortDescription: parsed.shortDescription || "",
          description: parsed.description || "",
          status: parsed.status,
          specs: parsed.specs,
          care: parsed.care,
          suitableFor: parsed.suitableFor,
          features: parsed.features,
          sortOrder: parsed.sortOrder,
          searchKey,
        },
        select: { id: true },
      });
      productId = created.id;

      await tx.variant.createMany({
        data: parsed.variants.map((v, i) => ({
          productId,
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? null,
          stock: v.stock,
          colorId: v.colorId || null,
          sizeId: v.sizeId || null,
          isActive: v.isActive,
          sortOrder: i,
        })),
      });

      if (parsed.images.length) {
        await tx.productImage.createMany({
          data: parsed.images.map((img, i) => ({
            productId,
            storageKey: img.storageKey,
            alt: img.alt ?? null,
            sortOrder: i,
          })),
        });
      }
      if (parsed.collectionIds.length) {
        await tx.collectionProduct.createMany({
          data: parsed.collectionIds.map((cid) => ({ productId, collectionId: cid })),
        });
      }

      await safeAudit({
        actorId: ctx.actor.userId,
        action: "product.create",
        entityType: "product",
        entityId: productId,
        after: {
          name: parsed.name,
          slug: parsed.slug,
          status: parsed.status,
          variants: parsed.variants.map((v) => ({ sku: v.sku, price: v.price, stock: v.stock })),
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return { id: productId, slug: parsed.slug, created: true };
    });

    invalidateProduct(result.id);
    return result;
  });
}

/** آرشیو/فعال‌سازی سریع — تغییر وضعیت تک‌مرحله‌ای */
export async function setProductStatusAction(input: {
  id: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.productsUpdate, async (ctx) => {
    const meta = await requestMeta();
    const existing = await db.product.findFirst({
      where: { id: input.id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) throw new DomainError("NOT_FOUND", "محصول یافت نشد.");

    await db.product.update({ where: { id: input.id }, data: { status: input.status } });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "product.status.update",
      entityType: "product",
      entityId: input.id,
      before: { status: existing.status },
      after: { status: input.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    invalidateProduct(input.id);
    return { id: input.id };
  });
}

/** تنظیم موجودی یک واریانت — inventory.update + audit اجباری (§20) */
export async function adjustStockAction(input: {
  variantId: string;
  newStock: number;
}): Promise<ActionResult<{ variantId: string; newStock: number }>> {
  return withAdminAction(PERMISSIONS.inventoryUpdate, async (ctx) => {
    if (!Number.isInteger(input.newStock) || input.newStock < 0) {
      throw new DomainError("VALIDATION_ERROR", "موجودی باید عدد صحیح و نامنفی باشد.");
    }
    const variant = await db.variant.findFirst({
      where: { id: input.variantId, deletedAt: null },
      select: { id: true, stock: true, reserved: true, sku: true, productId: true },
    });
    if (!variant) throw new DomainError("NOT_FOUND", "واریانت یافت نشد.");
    if (input.newStock < variant.reserved) {
      throw new DomainError(
        "VALIDATION_ERROR",
        `موجودی نمی‌تواند کمتر از رزرو فعلی (${variant.reserved}) باشد.`,
      );
    }

    const meta = await requestMeta();
    await db.variant.update({ where: { id: variant.id }, data: { stock: input.newStock } });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "inventory.adjust",
      entityType: "variant",
      entityId: variant.id,
      before: { stock: variant.stock, reserved: variant.reserved },
      after: { stock: input.newStock, reserved: variant.reserved },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    invalidateProduct(variant.productId);
    return { variantId: variant.id, newStock: input.newStock };
  });
}

/** حذف نرم محصول — products.delete + audit */
export async function deleteProductAction(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.productsDelete, async (ctx) => {
    const existing = await db.product.findFirst({
      where: { id: input.id, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    if (!existing) throw new DomainError("NOT_FOUND", "محصول یافت نشد.");

    const meta = await requestMeta();
    await db.product.update({
      where: { id: input.id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "product.delete",
      entityType: "product",
      entityId: input.id,
      before: { name: existing.name, slug: existing.slug },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    invalidateProduct(input.id);
    return { id: input.id };
  });
}
