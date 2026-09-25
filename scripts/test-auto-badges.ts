/**
 * تست E2E برچسب پرفروش خودکار (ADR 011) — مسیر واقعی:
 * سفارش ۵ عددی (سرویس) → شروع پرداخت (سرویس) → تأیید از روت واقعی
 * /checkout/callback با HTTP (زمینهٔ درخواست → revalidateTag واقعی کار می‌کند)
 * → چک برچسب «پرفروش» در HTML /shop → پاک‌سازی کامل
 *
 * نحوهٔ اجرا: DATABASE_URL=... bun scripts/test-auto-badges.ts
 * (گام تأیید درون اسکریپت با fetch به dev server زده می‌شود)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const SLUG = "prima-hand-face-towel";
const PHONE = "09121117777";
/** واریانت با موجودی کافی — تست ۵ عددی روی این واریانت انجام می‌شود */
const VARIANT_ID = "cmufs3w4d0017lk5npt7k3b6d"; // PRM-HF-3575-BGE-V2 (stock 7)

async function main() {
  const variant = await db.variant.findUnique({
    where: { id: VARIANT_ID },
    select: {
      id: true,
      colorId: true,
      sizeId: true,
      stock: true,
      reserved: true,
      product: { select: { id: true, name: true, slug: true, deletedAt: true, status: true } },
    },
  });
  if (!variant || variant.product.deletedAt || variant.product.status !== "ACTIVE") {
    throw new Error("واریانت تست پیدا نشد");
  }
  const product = variant.product;
  console.log(`واریانت تست: ${variant.id} (آزاد=${variant.stock - variant.reserved})`);

  // ── ۱) سفارش واقعی ۵ عددی — همان سرویس چک‌اوت تولید
  const { placeOrder } = await import("../src/core/commerce/checkout-service");
  const placed = await placeOrder({
    userId: null,
    lines: [{ productId: product.id, colorId: variant.colorId, sizeId: variant.sizeId, quantity: 5 }],
    address: {
      fullName: "تست برچسب خودکار",
      phone: PHONE,
      province: "تهران",
      city: "تهران",
      postalCode: "1111111111",
      line: "خیابان تست، پلاک ۱",
    },
    shippingMethod: "standard",
  });
  console.log(`سفارش ثبت شد: ${placed.orderCode} (مبلغ ${placed.grandTotal})`);

  // ── ۲) شروع پرداخت — رکورد Payment با authority
  const { startPayment } = await import("../src/core/commerce/payment-service");
  const started = await startPayment({ orderId: placed.orderId, userId: null });
  const paymentRow = await db.payment.findUnique({
    where: { id: started.paymentId },
    select: { authority: true },
  });
  if (!paymentRow?.authority) throw new Error("authority درگاه پیدا نشد");

  // ── ۳) تأیید از روت واقعی HTTP — زمینهٔ درخواست (revalidateTag واقعی)
  const cbUrl = `${BASE}/checkout/callback?authority=${encodeURIComponent(paymentRow.authority)}&status=OK`;
  const res = await fetch(cbUrl, { redirect: "manual" });
  console.log(`callback HTTP: ${res.status} → ${res.headers.get("location") ?? "-"}`);

  // ── ۴) گزارش پرفروش خودکار — محاسبهٔ مستقل روی DB (بدون import سمت-سرور)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const grouped = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] },
        placedAt: { gte: since },
        payments: { none: { status: "REFUNDED" } },
      },
    },
    _sum: { quantity: true },
  });
  const sold = grouped.find((g) => g.productId === product.id)?._sum.quantity ?? 0;
  console.log(`فروش ۳۰ روز اخیر ${SLUG}: ${sold} عدد (حد = ۵)`);
  if (sold < 5) throw new Error("FAIL — فروش به حد نرسید");
  console.log("✅ PASS گزارش — محصول به حد رسید؛ برچسب خودکار باید فعال باشد");

  // ── ۵) برچسب در HTML واقعی /shop (بعد از invalidation واقعی)
  const shopHtml = await (await fetch(`${BASE}/shop`)).text();
  const badgeShown = shopHtml.includes("پرفروش");
  console.log(badgeShown ? "✅ PASS ویترین — برچسب «پرفروش» در /shop دیده شد" : "❌ FAIL ویترین — برچسب در /shop نیست");

  // ── ۶) پاک‌سازی کامل — برگرداندن دقیق وضعیت
  const order = await db.order.findUnique({
    where: { id: placed.orderId },
    include: { items: { select: { variantId: true, quantity: true } }, payments: { select: { id: true } } },
  });
  if (order) {
    // پرداخت PAID شده = stock کم شده (convertReservation) — برگرداندن stock
    for (const item of order.items) {
      await db.variant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
    }
    await db.refund.deleteMany({ where: { orderId: order.id } });
    await db.shipment.deleteMany({ where: { orderId: order.id } });
    await db.inventoryReservation.deleteMany({ where: { orderId: order.id } });
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.smsLog.deleteMany({ where: { orderId: order.id } });
    await db.payment.deleteMany({ where: { id: { in: order.payments.map((p) => p.id) } } });
    await db.order.delete({ where: { id: order.id } });
  }
  await db.smsLog.deleteMany({ where: { to: PHONE } });
  await db.outboxEvent.deleteMany({});
  console.log("پاک‌سازی کامل شد — فروشگاه به حالت تمیز برگشت");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
