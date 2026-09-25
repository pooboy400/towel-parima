/**
 * پاک‌سازی داده‌های تست M5 — بازگرداندن فروشگاه به حالت تمیز دمو
 * حذف: سفارش‌های تست + پرداخت/استرداد/ارسال/رزرو/کالا‌های سفارش + پیامک‌ها + رخدادها
 *      + کاربران تست امروز + audit مرتبط + برگرداندن stock
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TEST_ORDER_CODES = ["8984619698", "0625406382", "3126939143"];
const TEST_PHONES = ["09121119999", "09121118888"];

async function main() {
  const orders = await db.order.findMany({
    where: { code: { in: TEST_ORDER_CODES } },
    include: { items: { select: { variantId: true, quantity: true } }, payments: { select: { id: true } } },
  });
  const orderIds = orders.map((o) => o.id);
  const paymentIds = orders.flatMap((o) => o.payments.map((p) => p.id));

  // ۱. برگرداندن stock — فقط رزروهای CONVERTED کم کرده‌اند
  for (const order of orders) {
    for (const item of order.items) {
      await db.variant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
  console.log("stock برگرشت");

  // ۲. حذف رکوردهای وابسته — ترتیب FK
  if (orderIds.length) {
    await db.refund.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.shipment.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.inventoryReservation.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.smsLog.deleteMany({ where: { orderId: { in: orderIds } } });
    if (paymentIds.length) {
      await db.payment.deleteMany({ where: { id: { in: paymentIds } } });
    }
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
    await db.auditLog.deleteMany({ where: { entityType: "Order", entityId: { in: orderIds } } });
  }
  console.log(`سفارش‌های تست حذف شد: ${orders.length}`);

  // ۳. پیامک‌ها و رخدادهای باقی‌ماندهٔ تست
  await db.smsLog.deleteMany({ where: { to: { in: TEST_PHONES } } });
  await db.outboxEvent.deleteMany({});
  console.log("پیامک‌ها/رخدادهای تست پاک شد");

  // ۴. کاربران تست امروز — با همه وابسته‌ها
  for (const phone of TEST_PHONES) {
    const user = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) continue;
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.otpCode.deleteMany({ where: { phone } });
    await db.wishlistItem.deleteMany({ where: { userId: user.id } });
    await db.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
    await db.cart.deleteMany({ where: { userId: user.id } });
    await db.address.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
  console.log("کاربران تست امروز حذف شدند");

  // ۵. راستی‌آزمایی نهایی
  const [ordersLeft, outboxLeft, smsLeft, carts] = await Promise.all([
    db.order.count(),
    db.outboxEvent.count(),
    db.smsLog.count(),
    db.cartItem.count(),
  ]);
  console.log({ ordersLeft, outboxLeft, smsLeft, cartItems: carts });
  console.log("✅ فروشگاه تمیز شد — آمادهٔ دمو");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
