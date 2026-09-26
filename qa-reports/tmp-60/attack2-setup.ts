/**
 * حملهٔ ۲ (redteam 60) — ست‌آپ: سفارش+پرداخت PENDING سرویس‌لول
 * خروجی: attack2-fixture.json (authority/orderId/variantId)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const RUN = `h60p${Date.now().toString(36)}`;

const category = (await db.category.findFirst())!;
const product = await db.product.create({
  data: {
    slug: `${RUN}-prod`,
    name: "محصول redteam-60 callback",
    shortDescription: "redteam",
    description: "redteam",
    status: "ACTIVE",
    categoryId: category.id,
    variants: {
      create: {
        sku: `H60RT${Date.now().toString(36)}`,
        price: 250_000,
        stock: 5,
        reserved: 2,
        isActive: true,
      },
    },
  },
  include: { variants: true },
});
const variant = product.variants[0];

const order = await db.order.create({
  data: {
    code: `H6${Math.random().toString(36).slice(2, 10)}`.slice(0, 10),
    phone: "09370000001",
    status: "PENDING",
    subtotal: 500_000,
    discountTotal: 0,
    shippingTotal: 0,
    taxTotal: 0,
    grandTotal: 500_000,
    currency: "IRT",
    shippingAddress: { fullName: "redteam-60", phone: "09370000001" },
    placedAt: new Date(),
    items: {
      create: {
        productId: product.id,
        variantId: variant.id,
        productNameSnapshot: product.name,
        variantNameSnapshot: "redteam",
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

await db.inventoryReservation.create({
  data: {
    variantId: variant.id,
    orderId: order.id,
    qty: 2,
    status: "ACTIVE",
    expiresAt: new Date(Date.now() + 20 * 60 * 1000),
  },
});

const authority = `h60rt-${RUN}`;
const payment = await db.payment.create({
  data: { orderId: order.id, provider: "zarinpal-mock", authority, amount: 500_000, status: "PENDING" },
  select: { id: true },
});

const fixture = { RUN, productId: product.id, variantId: variant.id, orderId: order.id, paymentId: payment.id, authority };
await Bun.write(new URL("./attack2-fixture.json", import.meta.url), JSON.stringify(fixture, null, 1));
console.log(JSON.stringify(fixture));
await db.$disconnect();
