/**
 * Integration — Commerce Core (M3): رزرو اتمیک، checkout تراکنشی، کوپن، گذار وضعیت
 * DoD بخش ۲۷: «تست race موجودی و سقف کوپن سبز · E2E checkout با درگاه mock»
 * اجرا: DATABASE_URL=... bun test tests/integration/commerce-core.test.ts
 */

import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import {
  reserveVariant,
  releaseReservation,
  convertReservation,
  expireStaleReservations,
} from "../../src/core/commerce/inventory-service";
import { placeOrder } from "../../src/core/commerce/checkout-service";
import { evaluateCoupon } from "../../src/core/commerce/coupon-service";
import { startPayment, confirmPayment, failPayment } from "../../src/core/commerce/payment-service";
import { transitionOrder, assertTransition } from "../../src/core/commerce/order-service";
import { DomainError } from "../../src/core/errors";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";

const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const TEST_TAG = `m3test-${Date.now()}`;
const created: { userIds: string[]; orderIds: string[]; variantIds: string[]; productIds: string[]; couponCodes: string[] } = {
  userIds: [],
  orderIds: [],
  variantIds: [],
  productIds: [],
  couponCodes: [],
};

async function makeVariantWithStock(stock: number) {
  const product = await db.product.create({
    data: {
      slug: `test-${TEST_TAG}-${created.variantIds.length}`,
      name: `محصول تست ${TEST_TAG}`,
      shortDescription: "تست",
      description: "تست",
      status: "ACTIVE",
      categoryId: (await db.category.findFirst())!.id,
      variants: {
        create: { sku: `SKU-${TEST_TAG}-${created.variantIds.length}`, price: 100_000, stock, isActive: true },
      },
    },
    include: { variants: true },
  });
  created.productIds.push(product.id);
  created.variantIds.push(product.variants[0].id);
  return product.variants[0];
}

async function makeCustomer() {
  const user = await db.user.create({
    data: { phone: `09${String(Math.floor(Math.random() * 1_000_000_00)).padStart(8, "0")}` },
  });
  created.userIds.push(user.id);
  return user;
}

beforeAll(async () => {
  await db.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  // پاکسازی — ترتیب FK-امن: رزروها قبل از واریانت‌ها (RESTRICT)
  for (const variantId of created.variantIds) {
    await db.inventoryReservation.deleteMany({ where: { variantId } });
  }
  await db.inventoryReservation.deleteMany({ where: { orderId: { in: created.orderIds } } });
  await db.cartItem.deleteMany({ where: { cart: { userId: { in: created.userIds } } } });
  await db.cart.deleteMany({ where: { userId: { in: created.userIds } } });
  await db.refund.deleteMany({ where: { orderId: { in: created.orderIds } } });
  await db.payment.deleteMany({ where: { orderId: { in: created.orderIds } } });
  await db.shipment.deleteMany({ where: { orderId: { in: created.orderIds } } });
  await db.couponRedemption.deleteMany({ where: { orderId: { in: created.orderIds } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: created.orderIds } } });
  await db.outboxEvent.deleteMany();
  await db.order.deleteMany({ where: { id: { in: created.orderIds } } });
  for (const productId of created.productIds) {
    await db.productImage.deleteMany({ where: { productId } });
    await db.collectionProduct.deleteMany({ where: { productId } });
    await db.product.deleteMany({ where: { id: productId } });
  }
  await db.coupon.deleteMany({ where: { code: { in: created.couponCodes } } });
  await db.session.deleteMany({ where: { userId: { in: created.userIds } } });
  await db.address.deleteMany({ where: { userId: { in: created.userIds } } });
  await db.user.deleteMany({ where: { id: { in: created.userIds } } });
  await db.$disconnect();
});

describe("InventoryService — رزرو اتمیک (§13)", () => {
  it("رزرو موفق reserved را زیاد می‌کند و رکورد ACTIVE می‌سازد", async () => {
    const variant = await makeVariantWithStock(10);
    const reservationId = await db.$transaction((tx) =>
      reserveVariant(tx, { variantId: variant.id, qty: 3 }),
    );
    const after = await db.variant.findUnique({ where: { id: variant.id } });
    expect(after!.reserved).toBe(3);
    const row = await db.inventoryReservation.findUnique({ where: { id: reservationId.reservationId } });
    expect(row!.status).toBe("ACTIVE");
    expect(row!.qty).toBe(3);
  });

  it("رزرو بیش از موجودی → OUT_OF_STOCK و هیچ تغییری نمی‌کند", async () => {
    const variant = await makeVariantWithStock(2);
    expect(
      db.$transaction((tx) => reserveVariant(tx, { variantId: variant.id, qty: 3 })),
    ).rejects.toThrow(DomainError);
    const after = await db.variant.findUnique({ where: { id: variant.id } });
    expect(after!.reserved).toBe(0);
  });

  it("race: دو tx همزمان روی ۱ موجودی — فقط یکی برنده است", async () => {
    const variant = await makeVariantWithStock(1);
    const results = await Promise.allSettled([
      db.$transaction((tx) => reserveVariant(tx, { variantId: variant.id, qty: 1 })),
      db.$transaction((tx) => reserveVariant(tx, { variantId: variant.id, qty: 1 })),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const after = await db.variant.findUnique({ where: { id: variant.id } });
    expect(after!.reserved).toBe(1);
  });

  it("release فقط reserved را کم می‌کند؛ convert هر دو را کم می‌کند", async () => {
    const variant = await makeVariantWithStock(5);
    const { reservationId: rid1 } = await db.$transaction((tx) =>
      reserveVariant(tx, { variantId: variant.id, qty: 2 }),
    );
    await db.$transaction((tx) => releaseReservation(tx, rid1));
    let v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.reserved).toBe(0);

    const { reservationId: rid2 } = await db.$transaction((tx) =>
      reserveVariant(tx, { variantId: variant.id, qty: 2 }),
    );
    await db.$transaction((tx) => convertReservation(tx, rid2));
    v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.stock).toBe(3);
    expect(v!.reserved).toBe(0);
  });

  it("worker انقضا رزروهای منقضی را EXPIRED و موجودی را آزاد می‌کند", async () => {
    const variant = await makeVariantWithStock(5);
    await db.$transaction((tx) =>
      reserveVariant(tx, {
        variantId: variant.id,
        qty: 2,
        ttlMs: -1000, // قبلاً منقضی شده
      }),
    );
    const expired = await expireStaleReservations();
    expect(expired).toBeGreaterThanOrEqual(1);
    const v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.reserved).toBe(0);
    const rows = await db.inventoryReservation.findMany({
      where: { variantId: variant.id },
    });
    expect(rows.every((r) => r.status === "EXPIRED")).toBe(true);
  });

  // ─── رگرسیون TOCTOU double-decrement (گزارش 47-a HIGH-1) ───

  it("رفع TOCTOU: release دوم روی رزرو RELEASED → no-op (reserved یک‌بار کم می‌شود)", async () => {
    const variant = await makeVariantWithStock(6);
    const { reservationId: rid } = await db.$transaction((tx) =>
      reserveVariant(tx, { variantId: variant.id, qty: 2 }),
    );
    // لغو سفارش و سپس رویداد همزمان دوباره (مثلاً failPayment دیررسیده)
    await db.$transaction((tx) => releaseReservation(tx, rid));
    await db.$transaction((tx) => releaseReservation(tx, rid));
    const v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.reserved).toBe(0); // نه −2
    const row = await db.inventoryReservation.findUnique({ where: { id: rid } });
    expect(row!.status).toBe("RELEASED");
  });

  it("رفع TOCTOU: convert بعد از release → no-op (رقابت لغو×پرداخت)", async () => {
    const variant = await makeVariantWithStock(6);
    const { reservationId: rid } = await db.$transaction((tx) =>
      reserveVariant(tx, { variantId: variant.id, qty: 2 }),
    );
    await db.$transaction((tx) => releaseReservation(tx, rid)); // cancelOrder برنده شد
    await db.$transaction((tx) => convertReservation(tx, rid)); // confirmPayment دیر رسید
    const v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.reserved).toBe(0);
    expect(v!.stock).toBe(6); // stock کم نشده — فروشی در کار نبوده
  });

  it("رفع TOCTOU: انقضای worker روی رزروِ قبلاً CONVERTED → موجودی خراب نمی‌شود", async () => {
    const variant = await makeVariantWithStock(5);
    const { reservationId: rid } = await db.$transaction((tx) =>
      reserveVariant(tx, { variantId: variant.id, qty: 2, ttlMs: -1000 }),
    );
    // پرداخت دقیقاً لحظهٔ انقضا موفق شد (رکورد هنوز ACTIVE بود)
    await db.$transaction((tx) => convertReservation(tx, rid));
    // worker انقضا حالا می‌رسد — نباید reserved منفی شود
    await expireStaleReservations();
    const v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.reserved).toBe(0); // 0 باقی می‌ماند، نه −2
    expect(v!.stock).toBe(3);
    const row = await db.inventoryReservation.findUnique({ where: { id: rid } });
    expect(row!.status).toBe("CONVERTED"); // وضعیت هم خراب نشد
  });
});

describe("CheckoutService — ثبت تراکنشی (§10.1)", () => {
  it("سفارش کامل می‌سازد: snapshot + رزرو + کد رهگیری ۱۰ رقمی", async () => {
    const variant = await makeVariantWithStock(5);
    const user = await makeCustomer();

    const result = await placeOrder({
      userId: user.id,
      lines: [{ productId: variant.productId, colorId: null, sizeId: null, quantity: 2 }],
      address: {
        fullName: "تست تست",
        phone: "09121112233",
        province: "تهران",
        city: "تهران",
        postalCode: "1965843111",
        line: "خیابان تست پلاک ۱",
      },
      shippingMethod: "standard",
    });

    created.orderIds.push(result.orderId);
    expect(result.orderCode).toMatch(/^\d{10}$/);
    expect(result.grandTotal).toBe(2 * 100_000 + 89_000); // زیر آستانه ارسال رایگان

    const order = await db.order.findUnique({
      where: { id: result.orderId },
      include: { items: true, reservations: true },
    });
    expect(order!.status).toBe("PENDING");
    expect(order!.items).toHaveLength(1);
    expect(order!.items[0].unitPrice).toBe(100_000);
    expect(order!.items[0].productNameSnapshot).toContain("تست");
    expect(order!.reservations).toHaveLength(1);
    expect(order!.reservations[0].status).toBe("ACTIVE");

    const v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.reserved).toBe(2);
  });

  it("خطای موجودی در رزرو → rollback کامل: هیچ سفارشی باقی نمی‌ماند", async () => {
    const variant = await makeVariantWithStock(1);
    const before = await db.order.count();

    try {
      await placeOrder({
        userId: null,
        lines: [
          { productId: variant.productId, colorId: null, sizeId: null, quantity: 1 },
          { productId: variant.productId, colorId: null, sizeId: null, quantity: 5 },
        ],
        address: {
          fullName: "تست تست",
          phone: "09121112233",
          province: "تهران",
          city: "تهران",
          postalCode: "1965843111",
          line: "خیابان تست پلاک ۱",
        },
        shippingMethod: "standard",
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
    }

    const after = await db.order.count();
    expect(after).toBe(before);
    const v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.reserved).toBe(0);
  });
});

describe("Coupon — سقف تراکنشی", () => {
  it("تخفیف PERCENT با سقف maxDiscount محاسبه می‌شود", async () => {
    const code = `TEST-${TEST_TAG}`.toUpperCase(); // قرارداد: کدها همیشه uppercase ذخیره/جستجو می‌شوند
    await db.coupon.create({
      data: {
        code,
        type: "PERCENT",
        value: 50,
        maxDiscount: 20_000,
        isActive: true,
      },
    });
    created.couponCodes.push(code);
    const evaluation = await evaluateCoupon(code, 100_000);
    expect(evaluation.discount).toBe(20_000); // 50٪ = 50000 → سقف 20000
  });

  it("usageLimit پر شده → COUPON_INVALID", async () => {
    const code = `LIM-${TEST_TAG}`.toUpperCase();
    await db.coupon.create({
      data: {
        code,
        type: "FIXED",
        value: 10_000,
        usageLimit: 1,
        isActive: true,
      },
    });
    created.couponCodes.push(code);

    const variant = await makeVariantWithStock(5);
    const r1 = await placeOrder({
      userId: null,
      lines: [{ productId: variant.productId, colorId: null, sizeId: null, quantity: 1 }],
      address: {
        fullName: "تست تست",
        phone: "09121112233",
        province: "تهران",
        city: "تهران",
        postalCode: "1965843111",
        line: "خیابان تست پلاک ۱",
      },
      shippingMethod: "standard",
      couponCode: code,
    });
    created.orderIds.push(r1.orderId);
    expect(r1.grandTotal).toBe(100_000 + 89_000 - 10_000);

    const coupon = await db.coupon.findUnique({ where: { code } });
    expect(coupon!.usedCount).toBe(1);

    try {
      await placeOrder({
        userId: null,
        lines: [{ productId: variant.productId, colorId: null, sizeId: null, quantity: 1 }],
        address: {
          fullName: "تست تست",
          phone: "09121112233",
          province: "تهران",
          city: "تهران",
          postalCode: "1965843111",
          line: "خیابان تست پلاک ۱",
        },
        shippingMethod: "standard",
        couponCode: code,
      });
      expect.unreachable();
    } catch (e) {
      expect((e as DomainError).code).toBe("COUPON_INVALID");
    }
  });
});

describe("PaymentService — تأیید idempotent (§10.2)", () => {
  it("confirm → PAID + Order PROCESSING + رزرو CONVERTED؛ callback تکراری بدون اثر مضاعف", async () => {
    const variant = await makeVariantWithStock(5);
    const placed = await placeOrder({
      userId: null,
      lines: [{ productId: variant.productId, colorId: null, sizeId: null, quantity: 1 }],
      address: {
        fullName: "تست تست",
        phone: "09121112233",
        province: "تهران",
        city: "تهران",
        postalCode: "1965843111",
        line: "خیابان تست پلاک ۱",
      },
      shippingMethod: "standard",
    });
    created.orderIds.push(placed.orderId);

    // startPayment خارج از tx است — توسط لایه Action صدا زده می‌شود
    const { paymentId } = await startPayment({ orderId: placed.orderId, userId: null });
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    expect(payment!.status).toBe("PENDING");

    const c1 = await confirmPayment(payment!.authority);
    expect(c1.ok).toBe(true);
    expect(c1.status).toBe("PAID");

    // callback تکراری ×۲ — بدون اثر مضاعف
    const c2 = await confirmPayment(payment!.authority);
    expect(c2.ok).toBe(true);
    expect(c2.status).toBe("ALREADY_PAID");
    const c3 = await confirmPayment(payment!.authority);
    expect(c3.ok).toBe(true);
    expect(c3.status).toBe("ALREADY_PAID");

    const order = await db.order.findUnique({
      where: { id: placed.orderId },
      include: { reservations: true },
    });
    expect(order!.status).toBe("PROCESSING");
    expect(order!.reservations.every((r) => r.status === "CONVERTED")).toBe(true);

    const v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.stock).toBe(4); // 5−1
    expect(v!.reserved).toBe(0);

    // PaymentSucceeded فقط یک‌بار
    const events = await db.outboxEvent.findMany({
      where: { type: "PaymentSucceeded", payload: { path: ["orderId"], equals: placed.orderId } },
    });
    expect(events).toHaveLength(1);
  });

  it("پرداخت ناموفق → Payment FAILED + Order CANCELLED + رزرو RELEASED", async () => {
    const variant = await makeVariantWithStock(5);
    const placed = await placeOrder({
      userId: null,
      lines: [{ productId: variant.productId, colorId: null, sizeId: null, quantity: 1 }],
      address: {
        fullName: "تست تست",
        phone: "09121112233",
        province: "تهران",
        city: "تهران",
        postalCode: "1965843111",
        line: "خیابان تست پلاک ۱",
      },
      shippingMethod: "standard",
    });
    created.orderIds.push(placed.orderId);

    const { paymentId } = await startPayment({ orderId: placed.orderId, userId: null });
    const payment = await db.payment.findUnique({ where: { id: paymentId } });

    await failPayment({ authority: payment!.authority, reason: "لغو کاربر" });

    const order = await db.order.findUnique({
      where: { id: placed.orderId },
      include: { reservations: true },
    });
    expect(order!.status).toBe("CANCELLED");
    expect(order!.reservations.every((r) => r.status === "RELEASED")).toBe(true);
    const v = await db.variant.findUnique({ where: { id: variant.id } });
    expect(v!.reserved).toBe(0);
  });
});

describe("OrderService — ماشین وضعیت (§5.1)", () => {
  it("گذارهای غیرمجاز رد می‌شوند", () => {
    expect(() => assertTransition("CANCELLED", "PROCESSING")).toThrow();
    expect(() => assertTransition("PENDING", "DELIVERED")).toThrow();
    expect(() => assertTransition("DELIVERED", "SHIPPED")).toThrow();
  });

  it("ship → DELIVERED مسیر کامل مجاز است؛ SHIPPED→CANCELLED ممنوع", async () => {
    const variant = await makeVariantWithStock(5);
    const placed = await placeOrder({
      userId: null,
      lines: [{ productId: variant.productId, colorId: null, sizeId: null, quantity: 1 }],
      address: {
        fullName: "تست تست",
        phone: "09121112233",
        province: "تهران",
        city: "تهران",
        postalCode: "1965843111",
        line: "خیابان تست پلاک ۱",
      },
      shippingMethod: "standard",
    });
    created.orderIds.push(placed.orderId);
    const { paymentId } = await startPayment({ orderId: placed.orderId, userId: null });
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    await confirmPayment(payment!.authority);

    await transitionOrder(placed.orderId, "SHIPPED");
    await transitionOrder(placed.orderId, "DELIVERED");

    const order = await db.order.findUnique({ where: { id: placed.orderId } });
    expect(order!.status).toBe("DELIVERED");

    expect(transitionOrder(placed.orderId, "CANCELLED")).rejects.toThrow(DomainError);
  });
});
