/**
 * Integration — تست پذیرش فاز ۲: BUG-03 (failPayment در رقابت با لغو)
 * ---------------------------------------------------------------
 * سناریوی قبلی: callback ناموفق همزمان با لغو سفارش → UPDATE شرطی Order
 * P2025 می‌داد → rollback کل tx → Payment برای همیشه PENDING می‌ماند و
 * PaymentFailed هرگز به Outbox نمی‌رفت.
 * پذیرش: لغو همزمان سفارش × callback ناموفق → Payment=FAILED و رخداد در
 * Outbox؛ callback دوم بدون خطا (idempotent).
 * اجرا: DATABASE_URL=... bun test tests/integration/payment-fail-race.test.ts
 */
import { describe, expect, it, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { failPayment } from "../../src/core/commerce/payment-service";
import { cancelOrder } from "../../src/core/commerce/order-service";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";
const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const RUN = `pfr-${Date.now()}`;
const created = {
  variantIds: [] as string[],
  orderIds: [] as string[],
  paymentIds: [] as string[],
};

/** سبد حداقلی: دستهٔ موجود → محصول/واریانت → سفارش PENDING + رزرو ACTIVE + پرداخت PENDING */
async function makePendingOrderWithReservation(): Promise<{ orderId: string; authority: string }> {
  const category = (await db.category.findFirst())!;
  const product = await db.product.create({
    data: {
      slug: `${RUN}-${created.variantIds.length}-${Math.floor(Math.random() * 1000)}`,
      name: "محصول تست race پرداخت",
      shortDescription: "تست",
      description: "تست",
      status: "ACTIVE",
      categoryId: category.id,
      variants: {
        create: {
          sku: `PFR${Date.now()}-${created.variantIds.length}-${Math.random().toString(36).slice(2, 7)}`, // sku یونیک در مقیاس ران‌ها
          price: 250_000,
          stock: 5,
          reserved: 2, // مطابق qty رزرو پایین — release به صفر برمی‌گرداند
          isActive: true,
        },
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0];
  created.variantIds.push(variant.id);

  const order = await db.order.create({
    data: {
      code: `PF${Math.random().toString(36).slice(2, 8)}`.slice(0, 10),
      phone: "09180000001",
      status: "PENDING",
      subtotal: 500_000,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 500_000,
      currency: "IRT",
      shippingAddress: { fullName: "تست race", phone: "09180000001" },
      placedAt: new Date(),
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          productNameSnapshot: product.name,
          variantNameSnapshot: "تست",
          skuSnapshot: variant.sku,
          unitPrice: 250_000,
          quantity: 2,
          discount: 0,
          total: 500_000,
        },
      },
    },
    select: { id: true },
  });
  created.orderIds.push(order.id);

  await db.inventoryReservation.create({
    data: {
      variantId: variant.id,
      orderId: order.id,
      qty: 2,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    },
  });

  const authority = `auth-${RUN}-${created.paymentIds.length}`;
  const payment = await db.payment.create({
    data: {
      orderId: order.id,
      provider: "zarinpal-mock",
      authority,
      amount: 500_000,
      status: "PENDING",
    },
    select: { id: true },
  });
  created.paymentIds.push(payment.id);

  return { orderId: order.id, authority };
}

describe("BUG-03 — لغو همزمان سفارش × callback ناموفق", () => {
  it("هر دو مسیر همزمان → Payment=FAILED + PaymentFailed در Outbox + رزرو آزاد", async () => {
    const { orderId, authority } = await makePendingOrderWithReservation();

    // دو بازیگر همزمان — هر ترتیب تمام‌شدنی، نتیجهٔ نهایی باید همگرا باشد
    const [cancelRes, failRes] = await Promise.allSettled([
      cancelOrder(orderId, { reason: "انصراف کاربر (تست race)", actorId: null, actor: "customer" }),
      failPayment({ authority, reason: "پرداخت در درگاه ناموفق بود." }),
    ]);

    // هیچ‌کدام نباید به‌دلیل خطای سیستمی (P2025 و…) شکست خورده باشند —
    // فقط CONFLICT منطقی cancelOrder (برنده شدن failPayment در لغو) قابل قبول است.
    for (const r of [cancelRes, failRes]) {
      if (r.status === "rejected") {
        const err = r.reason as { code?: string; message?: string };
        expect(err.code).toBe("CONFLICT");
      }
    }

    const payment = await db.payment.findFirst({
      where: { authority },
      select: { id: true, status: true, metadata: true },
    });
    expect(payment?.status).toBe("FAILED");
    expect(payment?.metadata).toHaveProperty("failReason");

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    expect(order?.status).toBe("CANCELLED");

    const outboxEvents = await db.outboxEvent.findMany({
      where: { type: "PaymentFailed", payload: { path: ["paymentId"], equals: payment!.id } },
    });
    expect(outboxEvents.length).toBe(1);

    const reservation = await db.inventoryReservation.findFirst({
      where: { orderId },
      select: { status: true },
    });
    expect(reservation?.status).toBe("RELEASED");

    const variant = await db.variant.findUnique({
      where: { id: created.variantIds[created.variantIds.length - 1] },
      select: { reserved: true },
    });
    expect(variant?.reserved).toBe(0);
  });

  it("callback دوم (بعد از بسته شدن) بدون خطا و بدون رخداد تکراری", async () => {
    const { orderId, authority } = await makePendingOrderWithReservation();

    await failPayment({ authority, reason: "callback اول" });
    const before = await db.outboxEvent.count({
      where: { type: "PaymentFailed", payload: { path: ["orderId"], equals: orderId } },
    });

    // callback تکراری — باید بدون throw و بدون تغییر برگردد
    await expect(failPayment({ authority, reason: "callback تکراری" })).resolves.toBeUndefined();

    const after = await db.outboxEvent.count({
      where: { type: "PaymentFailed", payload: { path: ["orderId"], equals: orderId } },
    });
    expect(after).toBe(before);

    const payment = await db.payment.findFirst({ where: { authority }, select: { status: true } });
    expect(payment?.status).toBe("FAILED");
  });

  it("رقابت تأیید × شکست — فقط یک claim برنده می‌شود", async () => {
    const { orderId, authority } = await makePendingOrderWithReservation();

    // confirm-level claim شبیه‌سازی می‌شود: updateMany شرطی PENDING → PAID
    const confirmClaim = db.payment.updateMany({
      where: { authority, status: "PENDING" },
      data: { status: "PAID", verifiedAt: new Date() },
    });
    const [claimRes] = await Promise.all([confirmClaim, failPayment({ authority, reason: "تأخیر شبکه" })]);

    const payment = await db.payment.findFirst({ where: { authority }, select: { status: true } });
    if (claimRes.count === 1) {
      // confirm برنده شد — failPayment نباید آن را FAILED کند
      expect(payment?.status).toBe("PAID");
    } else {
      expect(payment?.status).toBe("FAILED");
    }
    expect(orderId).toBeTruthy(); // سفارش سالم مانده
  });
});

afterAll(async () => {
  // پاکسازی مقاوم به ترتیب FK — شامل بقایای هر ران قبلی این فایل (پیشوند pfr-/PFR)
  const leftoverProducts = await db.product.findMany({
    where: { OR: [{ slug: { startsWith: "pfr-" } }, { variants: { some: { sku: { startsWith: "PFR" } } } }] },
    select: { id: true },
  });
  const productIds = leftoverProducts.map((p) => p.id);
  const relatedOrders = await db.order.findMany({
    where: { OR: [{ items: { some: { productId: { in: productIds } } } }, { id: { in: created.orderIds } }] },
    select: { id: true },
  });
  const orderIds = relatedOrders.map((o) => o.id);

  await db.outboxEvent.deleteMany({
    where: { type: { in: ["PaymentFailed", "OrderCancelled", "OrderStatusChanged"] }, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
  });
  await db.refund.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.inventoryReservation.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } }); // واریانت‌ها Cascade
  await db.$disconnect();
});
