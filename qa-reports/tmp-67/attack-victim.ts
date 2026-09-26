/**
 * 67-hack — قربانی مشترک حملهٔ ۳ (جعل کوکی اثبات INFRA-09) و حملهٔ ۴ (callback تکراری)
 * سفارش مهمان + Payment PENDING → authority خروجی.
 * ⚠️ کوکی اثبات واقعی توسط سرور ست می‌شود (HMAC) — ما آن را لاگ نمی‌کنیم و استفاده نمی‌کنیم؛
 * فقط authority (که عمداً نشت‌پذیر فرض می‌شود) برای جعلِ sha256 بی‌کلید به‌کار می‌رود.
 */
import { PrismaClient } from "@prisma/client";
import { placeOrder } from "../../src/core/commerce/checkout-service";
import { startPayment } from "../../src/core/commerce/payment-service";

const db = new PrismaClient();

const v = (await db.variant.findUnique({ where: { id: "cmuib13xy001pnd15utkqaxqp" } }))!;
const order = await placeOrder({
  userId: null,
  lines: [{ productId: v.productId, colorId: v.colorId, sizeId: v.sizeId, quantity: 1 }],
  address: {
    fullName: "HACK67-victim",
    phone: "09336780001",
    province: "تهران",
    city: "تهران",
    postalCode: "1111111111",
    line: "خیابان قرمزتیم ۶۷ — قربانی",
  },
  shippingMethod: "standard",
  couponCode: null,
  note: "HACK67 attack",
});
const payment = await startPayment({ orderId: order.orderId, userId: null });

const row = await db.payment.findUnique({
  where: { authority: payment.authority },
  select: { status: true, amount: true, order: { select: { code: true, id: true } } },
});

const out = {
  orderId: order.orderId,
  orderCode: order.orderCode,
  paymentStatus: row?.status,
  amount: row?.amount,
  authority: payment.authority,
  redirectUrl: payment.redirectUrl,
};
console.log(JSON.stringify(out, null, 1));
await Bun.write(
  new URL("./victim.json", import.meta.url),
  JSON.stringify(out, null, 2),
);
await db.$disconnect();
