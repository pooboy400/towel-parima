/**
 * OrderService — گذار وضعیت سفارش (بخش ۵.۱ سند)
 * ---------------------------------------------------------------
 * هیچ گذار مستقیم با UPDATE ادمین انجام نمی‌شود؛ فقط متدهای دامنه با چک گذار.
 * مالکیت حقیقت: ماشین‌های Order/Payment/Shipment مستقل‌اند؛ سازگاری فقط اینجا.
 */

import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { releaseReservation } from "./inventory-service";
import { enqueueOutbox } from "./outbox-service";
import { invalidateStorefrontForOrder } from "./storefront-invalidation";
import {
  ORDER_TRANSITIONS as ORDER_TRANSITION_RULES,
  assertOrderTransition,
  type TransitionActor,
} from "@/domain/state-machines";
import type { OrderStatus } from "@/domain/models/commerce";

/**
 * BUG-04 (فاز ۲) — یک منبع حقیقت: نقشهٔ سادهٔ توپولوژی (بدون بازیگر) از همان
 * جدول ثروتمند ORDER_TRANSITIONS دامنه مشتق می‌شود — دو جدول موازی دیگر وجود
 * ندارد که واگرا شوند. enforce کامل با بازیگر از assertOrderTransition عبور می‌کند.
 */
export const ORDER_TRANSITIONS: Record<string, readonly string[]> =
  ORDER_TRANSITION_RULES.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.from] ??= []).push(r.to);
    return acc;
  }, {});

/** چک توپولوژیک خالص (بدون بازیگر) — برای تست/لاگ؛ enforce واقعی: assertOrderTransition */
export function assertTransition(from: string, to: string): void {
  const allowed = ORDER_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `گذار وضعیت از «${from}» به «${to}» مجاز نیست.`,
    );
  }
}

/**
 * لغو سفارش — رزروهای ACTIVE آزاد می‌شوند؛ اگر پرداخت PAID است refund ثبت می‌شود.
 * قانون طلایی §10.3: فراخوانی درگاه هرگز داخل tx — دو tx کوچک جدا.
 * BUG-04 (فاز ۲): بازیگر الزامی شد — جدول گذار چند-بازیگر است و لغو PENDING
 * هم برای customer (انصراف) و هم admin مجاز؛ چک قبلی بدون بازیگر لغو ادمین را 403 می‌کرد.
 */
export async function cancelOrder(
  orderId: string,
  opts: { reason: string; actorId: string | null; actor: TransitionActor },
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      reservations: true,
      payments: { where: { status: "PAID" } },
    },
  });
  if (!order) throw new DomainError("NOT_FOUND", "سفارش یافت نشد.");
  assertOrderTransition(order.status, "CANCELLED", opts.actor);

  // ── tx ۱: لغو + آزادسازی رزرو + رخداد
  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) {
      throw new DomainError("CONFLICT", "وضعیت سفارش همزمان تغییر کرده — دوباره تلاش کنید.");
    }

    for (const reservation of order.reservations) {
      if (reservation.status === "ACTIVE") {
        await releaseReservation(tx, reservation.id);
      }
    }

    await enqueueOutbox(tx, {
      type: "OrderCancelled",
      payload: { orderId, code: order.code, reason: opts.reason },
    });
  });

  // رزرو آزاد شد / فروش حذف شد — ویترین تازه شود
  await invalidateStorefrontForOrder(orderId);

  // ── خارج از tx: استرداد خودکار پرداخت‌های PAID (بخش ۵.۱ — فقط قبل از SHIPPED)
  for (const payment of order.payments) {
    if (!payment.transactionId) continue;
    const { paymentProvider } = await import("@/providers/payment");
    const refund = await paymentProvider.refundPayment({
      transactionId: payment.transactionId,
      amountIrt: payment.amount,
    });

    await db.$transaction(async (tx) => {
      if (refund.ok) {
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            orderId: order.id,
            amount: payment.amount,
            reason: opts.reason,
            status: "SUCCEEDED",
            providerRef: refund.providerRef ?? null,
            actorId: opts.actorId,
            succeededAt: new Date(),
          },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED" },
        });
        await enqueueOutbox(tx, {
          type: "RefundSucceeded",
          payload: { orderId: order.id, code: order.code, amount: payment.amount },
        });
      } else {
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            orderId: order.id,
            amount: payment.amount,
            reason: opts.reason,
            status: "FAILED",
            error: refund.message?.slice(0, 300) ?? null,
            actorId: opts.actorId,
          },
        });
      }
    });
  }
}

/**
 * ثبت ارسال — PROCESSING → SHIPPED با ایجاد Shipment و کد رهگیری.
 */
export async function shipOrder(
  orderId: string,
  input: { carrier?: string | null; trackingCode?: string | null },
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, shippingAddress: true, code: true },
  });
  if (!order) throw new DomainError("NOT_FOUND", "سفارش یافت نشد.");
  assertOrderTransition(order.status, "SHIPPED", "admin");

  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: "PROCESSING" },
      data: { status: "SHIPPED" },
    });
    if (updated.count === 0) {
      throw new DomainError("CONFLICT", "وضعیت سفارش همزمان تغییر کرده — دوباره تلاش کنید.");
    }
    await tx.shipment.create({
      data: {
        orderId,
        carrier: input.carrier ?? null,
        trackingCode: input.trackingCode ?? null,
        status: "SHIPPED",
        addressSnapshot: order.shippingAddress as object,
        shippedAt: new Date(),
      },
    });
    await enqueueOutbox(tx, {
      type: "OrderShipped",
      payload: { orderId, code: order.code, trackingCode: input.trackingCode ?? null },
    });
  });
}

/**
 * گذار عمومی (DELIVERED / RETURN_REQUESTED / RETURNED) — بدون عوارض جانبی سنگین.
 * RETURNED: موجودی اقلام برمی‌گردد (stock += qty).
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
): Promise<{ status: string }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, code: true, items: { select: { variantId: true, quantity: true } } },
  });
  if (!order) throw new DomainError("NOT_FOUND", "سفارش یافت نشد.");
  // گذارهای این مسیر از پنل ادمین می‌آیند — بازیگر admin (BUG-04)
  assertOrderTransition(order.status, to, "admin");

  if (to === "CANCELLED") {
    await cancelOrder(orderId, { reason: "لغو توسط ادمین", actorId: null, actor: "admin" });
    return { status: to };
  }
  if (to === "SHIPPED") {
    await shipOrder(orderId, {});
    return { status: to };
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: to }, // تایپ OrderStatus — بدون cast (BUG-11 را هم در همین تغییر رفع کرد)
    });
    if (updated.count === 0) {
      throw new DomainError("CONFLICT", "وضعیت سفارش همزمان تغییر کرده — دوباره تلاش کنید.");
    }

    if (to === "DELIVERED") {
      await tx.shipment.updateMany({
        where: { orderId, status: { in: ["SHIPPED", "IN_TRANSIT"] } },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
    }

    if (to === "RETURNED") {
      // برگرداندن موجودی اقلام
      for (const item of order.items) {
        await tx.variant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    await enqueueOutbox(tx, {
      type: "OrderStatusChanged",
      payload: { orderId, code: order.code, from: order.status, to },
    });
  });

  // RETURNED موجودی را برمی‌گرداند — ویترین تازه شود
  if (to === "RETURNED") {
    await invalidateStorefrontForOrder(orderId);
  }

  return { status: to };
}
