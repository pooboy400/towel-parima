/**
 * Order Admin Actions — گذار وضعیت، ثبت ارسال، لغو (بخش ۵.۱ سند)
 * همه از requirePermission → OrderService می‌گذرند؛ UPDATE مستقیم ممنوع.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { DomainError } from "@/core/errors";
import { withAdminAction, requestMeta, type ActionResult } from "@/lib/admin/action-helpers";
import { PERMISSIONS } from "@/core/auth/permissions";
import { safeAudit } from "@/core/audit";
import {
  cancelOrder,
  shipOrder,
  transitionOrder,
} from "@/core/commerce/order-service";
import { requestRefund } from "@/core/commerce/refund-service";

const orderIdSchema = z.string().min(1).max(64);

const shipSchema = z.object({
  orderId: orderIdSchema,
  carrier: z.string().trim().max(60).nullish(),
  trackingCode: z.string().trim().max(60).nullish(),
});

const transitionSchema = z.object({
  orderId: orderIdSchema,
  to: z.enum(["DELIVERED", "RETURNED", "CANCELLED"]),
});

/** گذار عمومی وضعیت (DELIVERED/RETURNED) یا لغو */
export async function transitionOrderAction(input: {
  orderId: string;
  to: "DELIVERED" | "RETURNED" | "CANCELLED";
}): Promise<ActionResult<{ status: string }>> {
  return withAdminAction(PERMISSIONS.ordersUpdate, async (ctx) => {
    const parsed = transitionSchema.parse(input);
    const meta = await requestMeta();

    if (parsed.to === "CANCELLED") {
      await cancelOrder(parsed.orderId, {
        reason: "لغو توسط ادمین",
        actorId: ctx.actor.userId,
      });
    } else {
      await transitionOrder(parsed.orderId, parsed.to);
    }

    await safeAudit({
      actorId: ctx.actor.userId,
      action: "order.transition",
      entityType: "Order",
      entityId: parsed.orderId,
      after: { to: parsed.to },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    revalidatePath("/admin/orders");
    return { status: parsed.to };
  });
}

/** ثبت ارسال — PROCESSING → SHIPPED با کد رهگیری */
export async function shipOrderAction(input: {
  orderId: string;
  carrier?: string | null;
  trackingCode?: string | null;
}): Promise<ActionResult<{ status: "SHIPPED" }>> {
  return withAdminAction(PERMISSIONS.ordersUpdate, async (ctx) => {
    const parsed = shipSchema.parse(input);
    const meta = await requestMeta();

    await shipOrder(parsed.orderId, {
      carrier: parsed.carrier ?? null,
      trackingCode: parsed.trackingCode ?? null,
    });

    await safeAudit({
      actorId: ctx.actor.userId,
      action: "order.ship",
      entityType: "Order",
      entityId: parsed.orderId,
      after: { carrier: parsed.carrier, trackingCode: parsed.trackingCode },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    revalidatePath("/admin/orders");
    return { status: "SHIPPED" as const };
  });
}

const refundSchema = z.object({
  orderId: orderIdSchema,
  amountIrt: z.number().int().positive().max(2_000_000_000),
  reason: z.string().trim().min(2, "دلیل بازگشت وجه را بنویسید").max(300),
});

/** بازگشت وجه — PROCESSING در درگاه (دمو) + Refund/Payment/AuditLog (بخش ۱۰.۳) */
export async function refundOrderAction(input: {
  orderId: string;
  amountIrt: number;
  reason: string;
}): Promise<ActionResult<{ status: string; refundedTotal: number }>> {
  return withAdminAction(PERMISSIONS.ordersRefund, async (ctx) => {
    const parsed = refundSchema.parse(input);
    const meta = await requestMeta();

    const result = await requestRefund({
      orderId: parsed.orderId,
      amountIrt: parsed.amountIrt,
      reason: parsed.reason,
      actorId: ctx.actor.userId,
    });

    await safeAudit({
      actorId: ctx.actor.userId,
      action: "order.refund",
      entityType: "Order",
      entityId: parsed.orderId,
      after: {
        refundId: result.refundId,
        amount: parsed.amountIrt,
        reason: parsed.reason,
        status: result.status,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    revalidatePath("/admin/orders");
    if (result.status === "FAILED") {
      // درگاه رد کرد — به‌صورت خطای دامنه بالا می‌رود (تلاش مجدد با رکورد جدید ممکن است)
      throw new DomainError(
        "PAYMENT_GATEWAY_ERROR",
        result.message ?? "برگشت وجه در درگاه ناموفق بود.",
      );
    }
    return { status: result.status, refundedTotal: result.refundedTotal };
  });
}
