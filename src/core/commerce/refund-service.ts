/**
 * RefundService — بازگشت وجه (بخش ۱۰.۳ و ۱۱ سند + State Machine RefundStatus) — M5
 * ---------------------------------------------------------------
 * چرخه: REQUESTED→PROCESSING (پذیرش ادمین) → فراخوانی درگاه خارج از tx
 *       → SUCCEEDED (providerRef) یا FAILED (error — قابل تلاش مجدد با رکورد جدید)
 *
 * قواعد:
 *  · فقط سفارش با پرداخت PAID قابل استرداد است (سفارش CANCELLED مسیر خودش را دارد).
 *  · سقف استرداد = مجموع پرداخت‌های موفق − مجموع استردادهای موفق.
 *  · هر بار فقط یک Refund در وضعیت PROCESSING برای یک سفارش.
 *  · تأیید نهایی درگاه همیشه خارج از tx (قانون طلایی §10.3) — دو tx کوچک.
 *  · idempotency: تلاش تکراری ادمین قبل از بسته‌شدن قبلی → CONFLICT.
 *  · پس از موفقیت: Payment → PARTIALLY_REFUNDED/REFUNDED + Outbox(RefundSucceeded).
 */

import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { paymentProvider } from "@/providers/payment";
import { enqueueOutbox } from "./outbox-service";
import { invalidateStorefrontForOrder } from "./storefront-invalidation";

export interface RefundResult {
  refundId: string;
  status: "SUCCEEDED" | "FAILED";
  refundedTotal: number;
  paymentStatus: string;
  message?: string;
}

export async function requestRefund(input: {
  orderId: string;
  amountIrt: number;
  reason: string;
  actorId: string | null;
}): Promise<RefundResult> {
  const amount = Math.floor(input.amountIrt);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new DomainError("VALIDATION_ERROR", "مبلغ بازگشت وجه نامعتبر است.");
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw new DomainError("VALIDATION_ERROR", "دلیل بازگشت وجه الزامی است.");
  }

  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: {
      payments: { orderBy: { createdAt: "asc" } },
      refunds: true,
    },
  });
  if (!order) throw new DomainError("NOT_FOUND", "سفارش یافت نشد.");
  if (order.status === "CANCELLED") {
    throw new DomainError(
      "INVALID_TRANSITION",
      "سفارش لغوشده از مسیر لغو می‌رود — استرداد مستقل ندارد.",
    );
  }

  // ── سقف مالی — از رکوردهای واقعی
  const paidPayments = order.payments.filter((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED");
  const paidTotal = order.payments
    .filter((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED")
    .reduce((s, p) => s + p.amount, 0);
  const refundedTotal = order.refunds
    .filter((r) => r.status === "SUCCEEDED")
    .reduce((s, r) => s + r.amount, 0);

  if (paidPayments.length === 0 || paidTotal === 0) {
    throw new DomainError("INVALID_TRANSITION", "این سفارش پرداخت موفقی برای استرداد ندارد.");
  }
  const inFlight = order.refunds.some((r) => r.status === "PROCESSING");
  if (inFlight) {
    throw new DomainError(
      "CONFLICT",
      "یک درخواست بازگشت وجه دیگر برای این سفارش در جریان است — منتظر نتیجه بمانید.",
    );
  }
  const remaining = paidTotal - refundedTotal;
  if (amount > remaining) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `مبلغ بازگشت بیشتر از باقی‌ماندهٔ قابل استرداد است (${remaining} تومان).`,
    );
  }

  // پرداخت مبدأ — آخرین پرداخت موفق با transactionId
  const payment = [...paidPayments].reverse().find((p) => p.transactionId);
  if (!payment) {
    throw new DomainError("INTERNAL", "پرداخت موفق بدون شناسه تراکنش درگاه — استرداد ممکن نیست.");
  }

  // ── tx ۱: پذیرش — Refund PROCESSING
  const refund = await db.refund.create({
    data: {
      paymentId: payment.id,
      orderId: order.id,
      amount,
      reason,
      status: "PROCESSING",
      actorId: input.actorId,
    },
    select: { id: true },
  });

  // ── فراخوانی درگاه — خارج از tx (قانون طلایی §10.3)
  const providerRes = await paymentProvider.refundPayment({
    transactionId: payment.transactionId!,
    amountIrt: amount,
  });

  // ── tx ۲: نتیجه
  if (!providerRes.ok) {
    await db.refund.update({
      where: { id: refund.id },
      data: { status: "FAILED", error: providerRes.message?.slice(0, 300) ?? null },
    });
    return {
      refundId: refund.id,
      status: "FAILED",
      refundedTotal,
      paymentStatus: payment.status,
      message: providerRes.message ?? "درگاه برگشت وجه را رد کرد — می‌توانید با رکورد جدید دوباره تلاش کنید.",
    };
  }

  const newRefundedTotal = refundedTotal + amount;
  const paymentStatus = newRefundedTotal >= paidTotal ? "REFUNDED" : "PARTIALLY_REFUNDED";

  await db.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: "SUCCEEDED",
        providerRef: providerRes.providerRef ?? null,
        succeededAt: new Date(),
      },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: paymentStatus },
    });
    await enqueueOutbox(tx, {
      type: "RefundSucceeded",
      payload: {
        orderId: order.id,
        code: order.code,
        amount,
        phone: order.phone,
      },
    });
  });

  // فروش شمارش تغییر کرد (مرجوع کامل از شمارش خارج می‌شود) — ویترین تازه شود
  await invalidateStorefrontForOrder(order.id);

  return {
    refundId: refund.id,
    status: "SUCCEEDED",
    refundedTotal: newRefundedTotal,
    paymentStatus,
  };
}
