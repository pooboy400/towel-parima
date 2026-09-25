/**
 * PaymentService — چرخه پرداخت (بخش ۱۰.۲ و ۱۱ سند)
 * ---------------------------------------------------------------
 * start: ثبت رکورد Payment (هر رکورد = یک تلاش) + redirectUrl از Provider.
 * confirm: verify سمت سرور (خارج tx) → تطبیق مبلغ → claim اتمیک PENDING→PAID
 *          → tx: Payment PAID · Order PROCESSING · رزرو CONVERTED + stock−=qty
 *          → Outbox(PaymentSucceeded). تکرار callback = بدون اثر مضاعف (§11).
 * fail:   Payment FAILED · Order CANCELLED · رزرو RELEASED.
 */

import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { paymentProvider } from "@/providers/payment";
import { enqueueOutbox } from "@/core/commerce/outbox-service";
import { invalidateStorefrontForOrder } from "./storefront-invalidation";
import { convertReservation, releaseReservation } from "./inventory-service";

/** callback مطلق — زرین‌پال URL کامل می‌خواهد؛ از هدرهای درخواست می‌سازیم (x-forwarded-host پس از پراکسی) */
async function absoluteCallbackUrl(path: string): Promise<string> {
  try {
    const h = await (await import("next/headers")).headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}${path}`;
  } catch {
    // خارج از scope درخواست (تست/worker) — env یا fallback
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    return `${site.replace(/\/$/, "")}${path}`;
  }
}

export interface StartResult {
  redirectUrl: string;
  paymentId: string;
}

/** شروع تلاش پرداخت — رکورد Payment جدید با authority یکتا */
export async function startPayment(input: {
  orderId: string;
  userId: string | null;
}): Promise<StartResult> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw new DomainError("NOT_FOUND", "سفارش یافت نشد.");

  // مالکیت: مهمان فقط سفارش خودش را از session جریان checkout می‌شناسد —
  // اگر سفارش متعلق به کاربر است، همان کاربر حق شروع پرداخت دارد.
  if (order.userId && input.userId && order.userId !== input.userId) {
    throw new DomainError("FORBIDDEN", "به این سفارش دسترسی ندارید.");
  }

  if (order.status !== "PENDING") {
    throw new DomainError("INVALID_TRANSITION", "این سفارش قابل پرداخت نیست.");
  }

  // اگر آخرین تلاش هنوز PENDING و تازه است → همان را ادامه بده (بدون رکورد جدید)
  const last = order.payments[0];
  const FIVE_MIN = 5 * 60 * 1000;
  if (
    last &&
    last.status === "PENDING" &&
    Date.now() - last.createdAt.getTime() < FIVE_MIN
  ) {
    return { redirectUrl: paymentProvider.buildResumeUrl(last.authority), paymentId: last.id };
  }

  const { redirectUrl, authority } = await paymentProvider.startPayment({
    orderCode: order.code,
    amountIrt: order.grandTotal,
    callbackUrl: await absoluteCallbackUrl("/checkout/callback"),
    phone: order.phone,
    description: `پرداخت سفارش ${order.code}`,
  });

  const payment = await db.payment.create({
    data: {
      orderId: order.id,
      provider: paymentProvider.name,
      authority,
      amount: order.grandTotal,
      status: "PENDING",
    },
    select: { id: true },
  });

  return { redirectUrl, paymentId: payment.id };
}

export interface ConfirmResult {
  ok: boolean;
  status: "PAID" | "FAILED" | "ALREADY_PAID" | "REFUNDED";
  orderCode: string;
  message?: string;
}

/**
 * تأیید پرداخت — مسیر callback/webhook. کاملاً idempotent (§11):
 * callback تکراری با همان authority فقط وضعیت قبلی را برمی‌گرداند.
 */
export async function confirmPayment(authority: string): Promise<ConfirmResult> {
  if (!authority) throw new DomainError("VALIDATION_ERROR", "authority نامعتبر است.");

  const payment = await db.payment.findUnique({
    where: { authority },
    include: {
      order: { include: { reservations: true } },
    },
  });
  if (!payment) throw new DomainError("NOT_FOUND", "پرداخت یافت نشد.");

  const order = payment.order;

  // ── idempotency: قبلاً موفق — هیچ اثر مضاعفی نمی‌سازیم
  if (payment.status === "PAID") {
    return { ok: true, status: "ALREADY_PAID", orderCode: order.code };
  }
  if (payment.status !== "PENDING") {
    return {
      ok: false,
      status: "FAILED",
      orderCode: order.code,
      message: "این تلاش پرداخت قبلاً بسته شده است.",
    };
  }

  // ── verify سمت سرور — خارج از tx (قانون طلایی §10.3)
  // خطای درگاه (مثل -51 زرین‌پال برای تراکنش پرداخت‌نشده) = شکست پرداخت — نه استثنا
  let verify;
  try {
    verify = await paymentProvider.verifyPayment({
      authority,
      amountIrt: payment.amount,
    });
  } catch (err) {
    const message =
      err instanceof DomainError
        ? err.message
        : "تأیید پرداخت در درگاه ناموفق بود.";
    await failPayment({ authority, reason: message });
    return { ok: false, status: "FAILED", orderCode: order.code, message };
  }

  if (!verify.ok) {
    await failPayment({ authority, reason: verify.message ?? "تأیید درگاه ناموفق بود." });
    return {
      ok: false,
      status: "FAILED",
      orderCode: order.code,
      message: verify.message ?? "پرداخت ناموفق بود.",
    };
  }

  // ── تطبیق مبلغ (بخش ۱۰.۲) — هر اختلاف = رد قطعی
  if (verify.amount !== undefined && verify.amount !== payment.amount) {
    await failPayment({ authority, reason: "مبلغ تأییدشده با سفارش مطابقت ندارد." });
    throw new DomainError("PAYMENT_VERIFY_FAILED", "مبلغ پرداخت با سفارش مطابقت ندارد.");
  }

  // ── گارد رزرو: اگر رزروها منقضی شده‌اند (worker رفته) قابل تأیید نیست
  const activeReservations = order.reservations.filter((r) => r.status === "ACTIVE");
  if (activeReservations.length === 0) {
    await failPayment({ authority, reason: "پنجره پرداخت منقضی شد — رزرو آزاد شده." });
    return {
      ok: false,
      status: "FAILED",
      orderCode: order.code,
      message: "پنجره پرداخت منقضی شده است — لطفاً دوباره خرید کنید.",
    };
  }

  // ── claim اتمیک PENDING → PAID — فقط یک callback برنده می‌شود
  const claimed = await db.payment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: { status: "PAID", transactionId: verify.transactionId ?? null, verifiedAt: new Date() },
  });
  if (claimed.count === 0) {
    // callback همزمان — وضعیت فعلی را برگردان (idempotent)
    const fresh = await db.payment.findUnique({ where: { id: payment.id } });
    return {
      ok: fresh?.status === "PAID",
      status: fresh?.status === "PAID" ? "ALREADY_PAID" : "FAILED",
      orderCode: order.code,
    };
  }

  // ── tx نهایی: Order PROCESSING + رزرو CONVERTED + Outbox
  // گارد race لغو×تأیید (MEDIUM-1 گزارش 47-a): سفارش با updateMany شرطی پیش می‌رود؛
  // اگر همزمان لغو شده بود → مسیر بازپرداخت خودکار به‌جای کرش P2025.
  const orderAdvanced = await db.$transaction(async (tx): Promise<boolean> => {
    const advanced = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    if (advanced.count === 0) return false;

    for (const reservation of activeReservations) {
      await convertReservation(tx, reservation.id);
    }

    await enqueueOutbox(tx, {
      type: "PaymentSucceeded",
      payload: {
        orderId: order.id,
        orderCode: order.code,
        paymentId: payment.id,
        amount: payment.amount,
        transactionId: verify.transactionId ?? null,
      },
    });
    return true;
  });

  if (orderAdvanced) {
    // فروش جدید ثبت شد — برچسب‌ها/موجودی ویترین تازه شود (ISR)
    await invalidateStorefrontForOrder(order.id);
    return { ok: true, status: "PAID", orderCode: order.code };
  }

  // ── race لغو×تأیید: پول گرفته شد (claim PAID) ولی سفارش همزمان لغو شده است.
  // بازپرداخت خودکار + پیامک RefundSucceeded — پول بدون مسیر نمی‌ماند.
  return await refundRacedPayment({
    paymentId: payment.id,
    orderId: order.id,
    orderCode: order.code,
    amount: payment.amount,
    transactionId: verify.transactionId ?? null,
  });
}

/**
 * بازپرداخت پرداختِ رقابتی — سفارش همزمان با تأیید پرداخت لغو شده است.
 * قانون طلایی §۱۰.۳: فراخوانی درگاه خارج از tx؛ نتیجه در tx جدا ثبت می‌شود.
 * اگر درگاه استرداد نکرد: رکورد Refund FAILED می‌ماند تا ادمین پیگیری کند (Payment=PAID صادقانه می‌ماند).
 */
async function refundRacedPayment(input: {
  paymentId: string;
  orderId: string;
  orderCode: string;
  amount: number;
  transactionId: string | null;
}): Promise<ConfirmResult> {
  const reason = "لغو همزمان سفارش با پرداخت — استرداد خودکار";

  let refundOk = false;
  let providerRef: string | null = null;
  let refundError: string | null = null;
  try {
    const refund = await paymentProvider.refundPayment({
      transactionId: input.transactionId ?? "",
      amountIrt: input.amount,
    });
    refundOk = refund.ok;
    providerRef = refund.providerRef ?? null;
    refundError = refund.ok ? null : refund.message?.slice(0, 300) ?? "استرداد درگاه ناموفق بود.";
  } catch (err) {
    refundError =
      err instanceof DomainError ? err.message : "خطای غیرمنتظره در استرداد درگاه.";
  }

  await db.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        paymentId: input.paymentId,
        orderId: input.orderId,
        amount: input.amount,
        reason,
        status: refundOk ? "SUCCEEDED" : "FAILED",
        providerRef,
        error: refundError,
        actorId: null, // سیستم — نه انسان
        ...(refundOk ? { succeededAt: new Date() } : {}),
      },
    });
    if (refundOk) {
      await tx.payment.update({
        where: { id: input.paymentId },
        data: { status: "REFUNDED" },
      });
      await enqueueOutbox(tx, {
        type: "RefundSucceeded",
        payload: { orderId: input.orderId, code: input.orderCode, amount: input.amount },
      });
    }
  });

  return {
    ok: false,
    status: refundOk ? "REFUNDED" : "FAILED",
    orderCode: input.orderCode,
    message: refundOk
      ? "سفارش در لحظهٔ پرداخت لغو شد؛ مبلغ شما به‌صورت خودکار برگشت داده شد."
      : "سفارش لغو شد؛ استرداد مبلغ در حال پیگیری است — پشتیبانی با شما تماس می‌گیرد.",
  };
}

/** شکست پرداخت — Payment FAILED · سفارش CANCELLED · رزرو RELEASED */
export async function failPayment(input: {
  authority: string;
  reason: string;
}): Promise<void> {
  const payment = await db.payment.findUnique({
    where: { authority: input.authority },
    include: { order: { include: { reservations: true } } },
  });
  if (!payment || payment.status !== "PENDING") return;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        metadata: { failReason: input.reason },
      },
    });
    await tx.order.update({
      where: { id: payment.orderId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    for (const reservation of payment.order.reservations) {
      if (reservation.status === "ACTIVE") {
        await releaseReservation(tx, reservation.id);
      }
    }
    await enqueueOutbox(tx, {
      type: "PaymentFailed",
      payload: { orderId: payment.orderId, paymentId: payment.id, reason: input.reason },
    });
  });

  // رزرو آزاد شد — موجودی ویترین تازه شود
  await invalidateStorefrontForOrder(payment.orderId);
}
