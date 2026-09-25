/**
 * CheckoutService — ارکستراسیون تراکنشی ثبت سفارش (بخش ۱۰.۱ سند)
 * ---------------------------------------------------------------
 * ✅ داخل یک DB Transaction:
 *   ۱. اعتبارسنجی نهایی سبد (قیمت/موجودی از DB — هرگز از کلاینت)
 *   ۲. رزرو اتمیک همه واریانت‌ها (SQL شرطی بخش ۱۳) → خطا = rollback کامل
 *   ۳. ایجاد Order + OrderItems (همه snapshotها)
 *   ۴. ایجاد InventoryReservation (ACTIVE, TTL ۲۰ دقیقه)
 *   ۵. مصرف کوپن (CouponRedemption + usedCount — گارد اتمیک سقف)
 *   ۶. OutboxEvent(OrderCreated)
 * ❌ خارج از tx: فراخوانی درگاه پرداخت / SMS
 *
 * پول: همه مبالغ IRT صحیح (بخش ۱۲). تخفیف خطی هرگز از مبلغ خط عبور نمی‌کند.
 * کلاینت فقط سه‌تایی (productId, colorId, sizeId) می‌فرستد — واریانت سروری
 * از روی آن resolve می‌شود؛ قیمت همیشه از DB.
 */

import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { enqueueOutbox } from "@/core/commerce/outbox-service";
import { invalidateStorefrontForOrder } from "./storefront-invalidation";
import { reserveVariant, RESERVATION_TTL_MS } from "./inventory-service";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface CheckoutResult {
  orderId: string;
  orderCode: string;
  grandTotal: number;
  /** انقضای پنجره پرداخت = انقضای رزرو */
  expiresAt: Date;
}

/** خط ورودی از UI — سه‌تایی کاتالوگ + تعداد */
export interface CheckoutLineInput {
  productId: string;
  colorId: string | null;
  sizeId: string | null;
  quantity: number;
}

export interface CheckoutAddressInput {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  line: string;
}

/* ------------------------------------------------------------------ */
/* قیمت‌گذاری سروری                                                    */
/* ------------------------------------------------------------------ */

/** هزینه ارسال بر اساس تنظیمات فروشگاه — ارسال رایگان بالای آستانه */
export async function computeShippingCost(
  subtotal: number,
  method: "standard" | "express",
): Promise<number> {
  if (subtotal === 0) return 0;
  let config: {
    freeShippingThreshold: number;
    standardShippingCost: number;
    expressShippingCost: number;
  };
  try {
    const { getStoreConfig } = await import("@/services/settings-service");
    config = await getStoreConfig();
  } catch {
    // خارج از Next (تست/worker) — تنظیمات پیش‌فرض
    const { storeConfig } = await import("@/lib/config");
    config = storeConfig;
  }
  if (subtotal >= config.freeShippingThreshold) return 0;
  return method === "express" ? config.expressShippingCost : config.standardShippingCost;
}

/* ------------------------------------------------------------------ */
/* کد رهگیری                                                           */
/* ------------------------------------------------------------------ */

/** کد رهگیری ۱۰ رقمی متمایز — crypto-safe با بازبینی یکتایی */
async function generateOrderCode(tx: Tx): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomInt(0, 1_000_000_000_0).toString().padStart(10, "0");
    const clash = await tx.order.findUnique({ where: { code }, select: { id: true } });
    if (!clash) return code;
  }
  throw new DomainError("INTERNAL", "خطا در تولید کد سفارش — دوباره تلاش کنید.");
}

/* ------------------------------------------------------------------ */
/* ثبت سفارش — tx واحد                                                 */
/* ------------------------------------------------------------------ */

export interface PlaceOrderInput {
  userId: string | null;
  lines: CheckoutLineInput[];
  address: CheckoutAddressInput;
  shippingMethod: "standard" | "express";
  couponCode?: string | null;
  note?: string | null;
}

/**
 * ثبت تراکنشی سفارش — قلب M3. هر خطا = rollback کامل (هیچ رزرو/سفارش نیمه‌کاره).
 */
export async function placeOrder(input: PlaceOrderInput): Promise<CheckoutResult> {
  if (input.lines.length === 0) {
    throw new DomainError("VALIDATION_ERROR", "سبد خرید خالی است.");
  }
  // تجمیع خط‌های تکراری (همان سه‌تایی از دو مسیر UI)
  const wanted = new Map<string, CheckoutLineInput>();
  for (const l of input.lines) {
    const qty = Math.floor(l.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new DomainError("VALIDATION_ERROR", "تعداد نامعتبر در سبد.");
    }
    const key = `${l.productId}__${l.colorId ?? "-"}__${l.sizeId ?? "-"}`;
    const prev = wanted.get(key);
    wanted.set(key, { ...l, quantity: Math.min((prev?.quantity ?? 0) + qty, 20) });
  }

  const result = await db.$transaction(
    async (tx) => {
      // ── ۱. اعتبارسنجی نهایی از DB — resolve سه‌تایی → واریانت
      const productIds = [...new Set([...wanted.values()].map((l) => l.productId))];
      const candidates = await tx.variant.findMany({
        where: {
          productId: { in: productIds },
          deletedAt: null,
          isActive: true,
          product: { is: { deletedAt: null, status: "ACTIVE" } },
        },
        select: {
          id: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          stock: true,
          reserved: true,
          colorId: true,
          sizeId: true,
          sortOrder: true,
          color: { select: { name: true } },
          size: { select: { name: true } },
          product: {
            select: {
              id: true,
              name: true,
              status: true,
              deletedAt: true,
              images: { select: { storageKey: true, sortOrder: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      });

      type ItemPlan = {
        variantId: string;
        productId: string;
        productName: string;
        variantName: string;
        sku: string;
        image: string | null;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
      };
      const items: ItemPlan[] = [];

      for (const line of wanted.values()) {
        const variant = candidates.find(
          (v) =>
            v.product.id === line.productId &&
            (v.colorId ?? null) === line.colorId &&
            (v.sizeId ?? null) === line.sizeId,
        );
        if (!variant) {
          throw new DomainError("OUT_OF_STOCK", "یکی از کالاهای سبد دیگر قابل خرید نیست.");
        }
        const available = variant.stock - variant.reserved;
        if (available < line.quantity) {
          throw new DomainError(
            "OUT_OF_STOCK",
            `موجودی «${variant.product.name}» کافی نیست (${Math.max(0, available)} عدد باقی مانده).`,
          );
        }
        const variantName = [variant.color?.name, variant.size?.name]
          .filter(Boolean)
          .join(" / ");
        items.push({
          variantId: variant.id,
          productId: variant.product.id,
          productName: variant.product.name,
          variantName,
          sku: variant.sku,
          image:
            [...variant.product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0]
              ?.storageKey ?? null,
          unitPrice: variant.price,
          quantity: line.quantity,
          lineTotal: variant.price * line.quantity,
        });
      }

      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const shippingTotal = await computeShippingCost(subtotal, input.shippingMethod);

      // ── کوپن — اعتبارسنجی داخل tx + snapshot
      let couponId: string | null = null;
      let couponCodeSnapshot: string | null = null;
      let discountTotal = 0;

      if (input.couponCode) {
        const code = input.couponCode.trim().toUpperCase();
        const coupon = await tx.coupon.findFirst({
          where: { code, isActive: true, deletedAt: null },
        });
        if (!coupon) throw new DomainError("COUPON_INVALID", "کد تخفیف معتبر نیست.");
        const now = new Date();
        if (coupon.startsAt && coupon.startsAt > now) {
          throw new DomainError("COUPON_INVALID", "این کد تخفیف هنوز فعال نشده است.");
        }
        if (coupon.expiresAt && coupon.expiresAt < now) {
          throw new DomainError("COUPON_INVALID", "این کد تخفیف منقضی شده است.");
        }
        if (coupon.minSubtotal !== null && subtotal < coupon.minSubtotal) {
          throw new DomainError("COUPON_INVALID", "مبلغ سبد برای این کد کافی نیست.");
        }
        let discount =
          coupon.type === "PERCENT"
            ? Math.floor((subtotal * coupon.value) / 100)
            : coupon.value;
        if (coupon.type === "PERCENT" && coupon.maxDiscount !== null) {
          discount = Math.min(discount, coupon.maxDiscount);
        }
        discountTotal = Math.max(0, Math.min(discount, subtotal));
        couponId = coupon.id;
        couponCodeSnapshot = coupon.code;
      }

      const grandTotal = Math.max(0, subtotal - discountTotal) + shippingTotal;

      // ── ۳. سفارش + اقلام (snapshot کامل)
      const orderCode = await generateOrderCode(tx);
      const order = await tx.order.create({
        data: {
          code: orderCode,
          userId: input.userId,
          phone: input.address.phone,
          status: "PENDING",
          subtotal,
          discountTotal,
          shippingTotal,
          taxTotal: 0,
          grandTotal,
          currency: "IRT",
          shippingAddress: {
            fullName: input.address.fullName,
            phone: input.address.phone,
            province: input.address.province,
            city: input.address.city,
            postalCode: input.address.postalCode,
            line: input.address.line,
          },
          couponCodeSnapshot,
          note: input.note?.trim() || null,
          placedAt: new Date(),
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              productNameSnapshot: i.productName,
              variantNameSnapshot: i.variantName,
              skuSnapshot: i.sku,
              imageUrlSnapshot: i.image,
              unitPrice: i.unitPrice,
              quantity: i.quantity,
              discount: 0,
              total: i.lineTotal,
            })),
          },
        },
        select: { id: true, code: true },
      });

      // ── ۲ + ۴. رزرو اتمیک همه واریانت‌ها (خطا = rollback کامل سفارش)
      let expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
      for (const item of items) {
        const reserved = await reserveVariant(tx, {
          variantId: item.variantId,
          qty: item.quantity,
          orderId: order.id,
        });
        expiresAt = reserved.expiresAt;
      }

      // ── ۵. مصرف کوپن (تراکنشی — گارد اتمیک سقف)
      if (couponId) {
        const { consumeCouponInTx } = await import("./coupon-service");
        await consumeCouponInTx(tx, { couponId, orderId: order.id, userId: input.userId });
      }

      // ── ۶. Outbox
      await enqueueOutbox(tx, {
        type: "OrderCreated",
        payload: {
          orderId: order.id,
          code: order.code,
          userId: input.userId,
          grandTotal,
          phone: input.address.phone,
        },
      });

      return { orderId: order.id, orderCode: order.code, grandTotal, expiresAt };
    },
    { isolationLevel: "ReadCommitted", timeout: 15_000 },
  );

  // رزرو فعال شد — موجودی ویترین تازه شود (ISR)
  await invalidateStorefrontForOrder(result.orderId);

  return result;
}

/* ------------------------------------------------------------------ */
/* خواندن سفارش‌ها                                                     */
/* ------------------------------------------------------------------ */

/** سفارش با کد رهگیری — برای صفحه پیگیری */
export async function getOrderByCode(code: string) {
  const clean = code.trim();
  if (!clean) return null;
  return db.order.findUnique({
    where: { code: clean },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      shipments: true,
    },
  });
}

/** تاریخچه سفارش‌های کاربر — پنل حساب کاربری */
export async function listUserOrders(userId: string, take = 20) {
  return db.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    take,
    include: { items: true },
  });
}
