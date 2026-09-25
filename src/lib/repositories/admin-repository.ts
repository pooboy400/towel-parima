/**
 * Admin Repository — کوئری‌های خواندنی پنل (M2)
 * ---------------------------------------------------------------
 * صفحات ادمین هرگز کش نمی‌شوند (بخش ۱۶.۲) — کوئری زنده با صفحه‌بندی.
 * محاسبات تجمیعی (قیمت مینیمم/موجودی آزاد) همان قواعد mappers.ts.
 */

import "server-only";
import { db } from "@/lib/db";
import { buildProductSearchKey } from "./mappers";
import { normalizePersian } from "@/domain/text/normalize-fa";
import { Prisma } from "@prisma/client";

export interface AdminProductListItem {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryId: string;
  categoryName: string | null;
  image: string | null;
  variantCount: number;
  minPrice: number | null;
  freeStock: number;
  sortOrder: number;
  updatedAt: string;
}

export interface AdminProductListResult {
  items: AdminProductListItem[];
  total: number;
  page: number;
  pages: number;
}

export async function adminListProducts(opts: {
  query?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED" | "ALL";
  categoryId?: string;
  page?: number;
  perPage?: number;
}): Promise<AdminProductListResult> {
  const perPage = opts.perPage ?? 20;
  const page = Math.max(1, opts.page ?? 1);

  const where: Prisma.ProductWhereInput = { deletedAt: null };
  if (opts.status && opts.status !== "ALL") where.status = opts.status;
  if (opts.categoryId) where.categoryId = opts.categoryId;

  const q = opts.query?.trim();
  if (q) {
    const normalized = normalizePersian(q);
    // جستجوی پنل: contains روی نام + searchKey نرمال‌شده (سبک و بدون preview flag)
    const byName = await db.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: normalized, mode: "insensitive" } },
          { searchKey: { contains: buildProductSearchKey(normalized, "", "", "") } },
          { slug: { contains: q.toLowerCase() } },
        ],
      },
      select: { id: true },
      take: 500,
    });
    where.id = byName.length ? { in: byName.map((r) => r.id) } : { in: ["__none__"] };
  }

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { storageKey: true } },
        variants: {
          where: { deletedAt: null },
          select: { price: true, stock: true, reserved: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  const items: AdminProductListItem[] = rows.map((p) => {
    const prices = p.variants.map((v) => v.price);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status as AdminProductListItem["status"],
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      image: p.images[0]?.storageKey ?? null,
      variantCount: p.variants.length,
      minPrice: prices.length ? Math.min(...prices) : null,
      freeStock: p.variants.reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0),
      sortOrder: p.sortOrder,
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** جزئیات کامل یک محصول برای فرم ویرایش */
export async function adminGetProduct(id: string) {
  const p = await db.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      collections: { include: { collection: { select: { id: true, name: true } } } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: {
        where: { deletedAt: null },
        include: { color: { select: { id: true, name: true } }, size: { select: { id: true, name: true } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });
  return p;
}

/** همه مجوزدهنده‌های فرم محصول: دسته‌ها، رنگ‌ها، سایزها، کالکشن‌ها */
export async function adminGetProductFormOptions() {
  const [categories, colors, sizes, collections] = await Promise.all([
    db.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.color.findMany({ select: { id: true, name: true, hex: true }, orderBy: { name: "asc" } }),
    db.size.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    db.collection.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return { categories, colors, sizes, collections };
}

/* ------------------------------------------------------------------ */
/* Audit — صفحه دفتر رویدادها                                          */
/* ------------------------------------------------------------------ */

export async function adminListAudit(opts: {
  action?: string;
  entityType?: string;
  actorId?: string;
  page?: number;
  perPage?: number;
}) {
  const perPage = opts.perPage ?? 30;
  const page = Math.max(1, opts.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {
    ...(opts.action ? { action: opts.action } : {}),
    ...(opts.entityType ? { entityType: opts.entityType } : {}),
    ...(opts.actorId ? { actorId: opts.actorId } : {}),
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
      actorName: r.actor?.name ?? r.actor?.email ?? null,
    })),
  };
}
