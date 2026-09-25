/**
 * Integration — فاکتور دوم پیگیری سفارش و گارد صفحهٔ success (SEC-04)
 * getOrderByCodeForTracking: کد + موبایل / getOrderByCodeForSuccess: نشست یا کوکی اثبات
 */
import { describe, expect, it, afterAll } from "bun:test";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  getOrderByCodeForTracking,
  getOrderByCodeForSuccess,
  paidProofValue,
} from "../../src/core/commerce/checkout-service";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";
const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const CODE = `T${Date.now().toString().slice(-9)}`; // 10 رقم یکتا
const PHONE = "09121110000";

let orderId = "";

async function seedOrder() {
  const order = await db.order.create({
    data: {
      code: CODE,
      phone: PHONE,
      status: "PROCESSING",
      subtotal: 100_000,
      discountTotal: 0,
      shippingTotal: 0,
      grandTotal: 100_000,
      shippingAddress: { fullName: "تست SEC04", phone: PHONE, province: "تهران", city: "تهران", line: "آدرس تست", postalCode: "1234567890" },
      placedAt: new Date(),
      payments: {
        create: {
          provider: "mock",
          authority: `MOCK-sec04-${Date.now().toString(36)}`,
          amount: 100_000,
          status: "PAID",
        },
      },
    },
    include: { payments: true },
  });
  orderId = order.id;
  return order;
}

afterAll(async () => {
  if (orderId) {
    await db.payment.deleteMany({ where: { orderId } });
    await db.order.delete({ where: { id: orderId } });
  }
  await db.$disconnect();
});

describe("SEC-04 — پیگیری سفارش با فاکتور دوم", () => {
  it("کد درست + موبایل درست → سفارش؛ موبایل غلط/نامعتبر → null؛ کد غلط → null", async () => {
    await seedOrder();

    const ok = await getOrderByCodeForTracking(CODE, PHONE);
    expect(ok?.code).toBe(CODE);

    // موبایل با فرمت متفاوت ولی همان شماره (بدون صفر اول) → پذیرفته می‌شود
    const variant = await getOrderByCodeForTracking(CODE, "912 111 0000");
    expect(variant?.code).toBe(CODE);

    expect(await getOrderByCodeForTracking(CODE, "09121119999")).toBeNull();
    expect(await getOrderByCodeForTracking(CODE, "12345")).toBeNull(); // موبایل نامعتبر
    expect(await getOrderByCodeForTracking("0000000000", PHONE)).toBeNull();
  }, 20_000);

  it("success: کوکی اثبات درست → سفارش؛ بدون اثبات/اثبات غلط → null", async () => {
    const order = await db.order.findUnique({ where: { code: CODE }, include: { payments: true } });
    expect(order).not.toBeNull();
    const authority = order!.payments[0].authority;

    // اثبات درست (همان چیزی که callback در کوکی می‌گذارد)
    const ok = await getOrderByCodeForSuccess(CODE, paidProofValue(authority), null);
    expect(ok?.code).toBe(CODE);

    // اثبات جعلی (غریبه فقط کد را می‌داند)
    const fake = createHash("sha256").update("forged-authority").digest("hex");
    expect(await getOrderByCodeForSuccess(CODE, fake, null)).toBeNull();
    expect(await getOrderByCodeForSuccess(CODE, null, null)).toBeNull();
    expect(await getOrderByCodeForSuccess("0000000000", paidProofValue(authority), null)).toBeNull();
  }, 20_000);

  it("success: مالک نشست بدون کوکی → سفارش؛ نشست غیرمالک → null", async () => {
    const user = await db.user.create({
      data: {
        email: `sec04-owner-${Date.now()}@prima.test`,
        phone: `0914${Date.now().toString().slice(-7)}`,
        name: "تست مالک SEC04",
        isActive: true,
        passwordHash: "x".repeat(20),
      },
    });
    try {
      await db.order.update({ where: { id: orderId }, data: { userId: user.id } });

      const owner = await getOrderByCodeForSuccess(CODE, null, user.id);
      expect(owner?.code).toBe(CODE);

      const stranger = await getOrderByCodeForSuccess(CODE, null, "other-user-id");
      expect(stranger).toBeNull();
    } finally {
      await db.order.update({ where: { id: orderId }, data: { userId: null } });
      await db.user.delete({ where: { id: user.id } });
    }
  }, 20_000);
});
