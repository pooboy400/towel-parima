/**
 * InventoryService — موجودی و رزرو (بخش ۱۳ سند معماری)
 * ---------------------------------------------------------------
 * مدل: stock (فیزیکی) − reserved (رزروشده) = available.
 * حقیقت قابل‌فروش فقط همین تفاضل است؛ هرگز مقدار محاسبه‌شده ذخیره نمی‌شود.
 *
 * رزرو با UPDATE شرطیِ خام و اتمیک — rowCount == 0 یعنی OUT_OF_STOCK.
 * همه تغییرها از مسیر همین سرویس می‌گذرند؛ هیچ UI/Action مستقیم UPDATE نمی‌زند.
 */

import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { invalidateStorefrontForVariants } from "./storefront-invalidation";
import type { Prisma } from "@prisma/client";

/** TTL رزرو — پنجره پرداخت (بخش ۱۳) */
export const RESERVATION_TTL_MS = 20 * 60 * 1000;

type Tx = Prisma.TransactionClient;

/**
 * رزرو اتمیک یک واریانت (داخل tx تماس‌گیرنده) — SQL دقیق بخش ۱۳:
 * UPDATE شرطی با شرط stock−reserved≥qty در همان WHERE — تحت هیچ رقابتی
 * reserved از stock عبور نمی‌کند. rowCount==0 → OUT_OF_STOCK → rollback کل tx.
 * خروجی: id رکورد InventoryReservation ساخته‌شده + expiresAt.
 */
export async function reserveVariant(
  tx: Tx,
  input: { variantId: string; qty: number; orderId?: string; ttlMs?: number },
): Promise<{ reservationId: string; expiresAt: Date }> {
  const qty = Math.floor(input.qty);
  if (!Number.isInteger(qty) || qty < 1) {
    throw new DomainError("VALIDATION_ERROR", "تعداد رزرو نامعتبر است.");
  }

  const expiresAt = new Date(Date.now() + (input.ttlMs ?? RESERVATION_TTL_MS));

  const updatedRows = await tx.$executeRaw`
    UPDATE "Variant"
    SET "reserved" = "reserved" + ${qty}, "updatedAt" = now()
    WHERE "id" = ${input.variantId}
      AND "isActive" = true
      AND "deletedAt" IS NULL
      AND ("stock" - "reserved") >= ${qty}
      AND "productId" IN (
        SELECT "id" FROM "Product"
        WHERE "deletedAt" IS NULL AND "status" = 'ACTIVE'
      )`;

  if (updatedRows === 0) {
    throw new DomainError("OUT_OF_STOCK", "موجودی این کالا کافی نیست — سبد را به‌روز کنید.");
  }

  const reservation = await tx.inventoryReservation.create({
    data: {
      variantId: input.variantId,
      orderId: input.orderId ?? null,
      qty,
      status: "ACTIVE",
      expiresAt,
    },
  });

  return { reservationId: reservation.id, expiresAt };
}

/** آیا واریانت قابل فروش است (فعال، بدون soft-delete، محصول زنده) */
export async function isVariantSellable(tx: Tx, variantId: string): Promise<boolean> {
  const variant = await tx.variant.findFirst({
    where: {
      id: variantId,
      deletedAt: null,
      isActive: true,
      product: { is: { deletedAt: null, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  return variant !== null;
}

/** موجودی آزاد یک واریانت — قابل‌فروش واقعی */
export async function getAvailableQty(tx: Tx, variantId: string): Promise<number> {
  const variant = await tx.variant.findFirst({
    where: { id: variantId, deletedAt: null },
    select: { stock: true, reserved: true, isActive: true },
  });
  if (!variant || !variant.isActive) return 0;
  return Math.max(0, variant.stock - variant.reserved);
}

/**
 * آزادسازی رزرو (لغو سفارش / خطای پرداخت) — فقط reserved−=qty.
 * اتمیک: claim با updateMany و قید status — رقابت پرداخت×لغو×انقضا فقط یک‌بار
 * decrement می‌زند (رفع TOCTOU double-decrement)؛ بقیه حالت‌ها no-op.
 */
export async function releaseReservation(tx: Tx, reservationId: string): Promise<void> {
  // claim اتمیک — اگر رزرو ACTIVE نباشد (RELEASED/CONVERTED/EXPIRED) هیچ کاری نکن
  const claimed = await tx.inventoryReservation.updateMany({
    where: { id: reservationId, status: "ACTIVE" },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
  if (claimed.count === 0) return;

  // فیلدهای qty/variantId تغییرناپذیرند — خواندن بعد از claim امن است
  const reservation = await tx.inventoryReservation.findUnique({
    where: { id: reservationId },
    select: { variantId: true, qty: true },
  });
  if (!reservation) return;

  await tx.variant.update({
    where: { id: reservation.variantId },
    data: { reserved: { decrement: reservation.qty } },
  });
}

/**
 * تبدیل رزرو به فروش قطعی (پرداخت موفق): stock−=qty و reserved−=qty همزمان.
 * claim اتمیک مثل releaseReservation — رقابت با انقضا/لغو فقط یک‌بار اعمال می‌شود.
 */
export async function convertReservation(tx: Tx, reservationId: string): Promise<void> {
  const claimed = await tx.inventoryReservation.updateMany({
    where: { id: reservationId, status: "ACTIVE" },
    data: { status: "CONVERTED" },
  });
  if (claimed.count === 0) return;

  const reservation = await tx.inventoryReservation.findUnique({
    where: { id: reservationId },
    select: { variantId: true, qty: true },
  });
  if (!reservation) return;

  await tx.variant.update({
    where: { id: reservation.variantId },
    data: {
      stock: { decrement: reservation.qty },
      reserved: { decrement: reservation.qty },
    },
  });
}

/**
 * Worker انقضا — رزروهای ACTIVE منقضی را EXPIRED می‌کند و موجودی آزاد می‌شود.
 * per-row tx (بخش ۱۰.۳) — رقابت با checkout امن است.
 * خروجی: تعداد رزروهای منقضی‌شده.
 */
export async function expireStaleReservations(now = new Date()): Promise<number> {
  const stale = await db.inventoryReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    select: { id: true, variantId: true },
    take: 200,
  });
  if (stale.length === 0) return 0;

  const freedVariantIds: string[] = [];
  let expired = 0;
  for (const { id } of stale) {
    try {
      await db.$transaction(async (tx) => {
        // claim اتمیک با همان قید انتخاب — رقابت با convert/release از اول حل است
        const claimed = await tx.inventoryReservation.updateMany({
          where: { id, status: "ACTIVE", expiresAt: { lt: now } },
          data: { status: "EXPIRED" },
        });
        if (claimed.count === 0) return;

        const reservation = await tx.inventoryReservation.findUnique({
          where: { id },
          select: { variantId: true, qty: true },
        });
        if (!reservation) return;

        await tx.variant.update({
          where: { id: reservation.variantId },
          data: { reserved: { decrement: reservation.qty } },
        });
        freedVariantIds.push(reservation.variantId);
        expired += 1;
      });
    } catch (err) {
      // BUG-09 (فاز ۳) — دیگر بی‌صدا نیست: قطع DB/خطاهای سیستمی باید در لاگ
      // دیده شوند؛ فقط خطای رقابتی موردانتظار (P2002/P2034 — رکورد همان دور
      // بعد پاک می‌شود) بدون نویز رد می‌شود.
      const e = err as { code?: string };
      if (e?.code === "P2002" || e?.code === "P2034") {
        // رقابت با checkout — رکورد در دور بعد پاک می‌شود
      } else {
        console.warn("[reservation-expiry] خطای آزادسازی رزرو:", err);
      }
    }
  }

  // موجودی آزاد شد — ویترین (کارت محصول/محدود) تازه شود
  if (freedVariantIds.length > 0) {
    await invalidateStorefrontForVariants(freedVariantIds);
  }
  return expired;
}
