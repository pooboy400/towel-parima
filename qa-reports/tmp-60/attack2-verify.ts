/**
 * حملهٔ ۲ (redteam 60) — راستی‌آزمایی پس از flood + پروب‌های تکمیلی
 * انتظار: صفر 500 · Payment=FAILED واحد · یک PaymentFailed در Outbox · رزرو RELEASED · reserved=0
 * + پروب برانگیختگی: callback?status=OK روی پرداخت FAILED → نباید PAID شود
 * + پروب بدون authority و POST method
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const f = await Bun.file(new URL("./attack2-fixture.json", import.meta.url)).json();
const BASE = "http://localhost:3000";

const payment = await db.payment.findUniqueOrThrow({
  where: { id: f.paymentId },
  select: { status: true, metadata: true },
});
const order = await db.order.findUniqueOrThrow({ where: { id: f.orderId }, select: { status: true } });
const outboxEvents = await db.outboxEvent.findMany({
  where: { type: "PaymentFailed", payload: { path: ["paymentId"], equals: f.paymentId } },
  select: { id: true, payload: true },
});
const orderCancelledEvents = await db.outboxEvent.count({
  where: { type: "OrderCancelled", payload: { path: ["orderId"], equals: f.orderId } },
});
const reservation = await db.inventoryReservation.findFirstOrThrow({ where: { orderId: f.orderId }, select: { status: true } });
const variant = await db.variant.findUniqueOrThrow({ where: { id: f.variantId }, select: { reserved: true, stock: true } });

// ── پروب برانگیختگی: status=OK روی FAILED — نباید به PAID برگردد
const okProbe = await fetch(`${BASE}/checkout/callback?authority=${f.authority}&status=OK`, { redirect: "manual" });
const paymentAfterOkProbe = await db.payment.findUniqueOrThrow({ where: { id: f.paymentId }, select: { status: true } });
const outboxAfterOkProbe = await db.outboxEvent.count({ where: { type: "PaymentSucceeded", payload: { path: ["paymentId"], equals: f.paymentId } } });

// ── پروب بدون authority
const noAuth = await fetch(`${BASE}/checkout/callback`, { redirect: "manual" });

// ── پروب POST (متد ناموجود)
const postProbe = await fetch(`${BASE}/checkout/callback?authority=${f.authority}&status=NOK`, { method: "POST", redirect: "manual" });

// ── پروب authority ناموجود (فینگرپرینت/اطلاعات)
const ghost = await fetch(`${BASE}/checkout/callback?authority=h60rt-does-not-exist&status=NOK`, { redirect: "manual" });

// ── پروب درگاه mock بدون کوکی اثبات (SEC-07)
const gw = await fetch(`${BASE}/mock-gateway?authority=${f.authority}`);
const gwBody = await gw.text();
const gwLeaks = gwBody.includes("500,000") || gwBody.includes("پرداخت سفارش");

const report = {
  paymentStatus: payment.status,
  paymentFailReason: (payment.metadata as { failReason?: string })?.failReason ?? null,
  orderStatus: order.status,
  paymentFailedOutboxCount: outboxEvents.length,
  orderCancelledOutboxCount: orderCancelledEvents,
  reservationStatus: reservation.status,
  variant: { reserved: variant.reserved, stock: variant.stock },
  okProbe: { status: okProbe.status, location: okProbe.headers.get("location"), paymentAfter: paymentAfterOkProbe.status, paymentSucceededEvents: outboxAfterOkProbe },
  noAuthProbe: { status: noAuth.status, location: noAuth.headers.get("location") },
  postProbe: { status: postProbe.status },
  ghostProbe: { status: ghost.status, location: ghost.headers.get("location") },
  mockGateway: { status: gw.status, leaksAmountOrCode: gwLeaks },
};
console.log(JSON.stringify(report, null, 1));
const verdict =
  payment.status === "FAILED" &&
  order.status === "CANCELLED" &&
  outboxEvents.length === 1 &&
  orderCancelledEvents === 1 &&
  reservation.status === "RELEASED" &&
  variant.reserved === 0 &&
  paymentAfterOkProbe.status === "FAILED" &&
  outboxAfterOkProbe === 0 &&
  !gwLeaks;
console.log("VERDICT DEFENDED =", verdict);
await Bun.write(new URL("./attack2-result.json", import.meta.url), JSON.stringify(report, null, 1));
await db.$disconnect();
