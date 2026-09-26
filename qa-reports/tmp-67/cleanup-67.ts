/**
 * 67-hack — پاکسازی فقط ردیف‌های «خودم» (نشان HACK67 / redteam67-)
 * ---------------------------------------------------------------
 * ⚠️ هرگز ردیف User/Session دیگران دست نمی‌زند — فیلترها:
 *   · کوپن: code startsWith 'HACK67-'
 *   · سفارش: note='HACK67 attack' یا couponCodeSnapshot startsWith 'HACK67-'
 *   · کاربر: name startsWith 'redteam67-' (بدون Session ساخته‌شده — هرگز Session لمس نمی‌شود)
 * زنجیرهٔ FK: CouponRedemption(Restrict) · Payment(Restrict) · OrderItem(Restrict) ·
 *             InventoryReservation(SetNull + شمارندهٔ reserved) · OutboxEvent(payload)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** client اختیاری — استفاده از همان نمونهٔ اسکریپتِ حمله (جلوگیری از panic دو انجین در یک پروسه) */
export async function cleanupMyRows(
  client: PrismaClient = db,
): Promise<{
  orders: number;
  coupons: number;
  users: number;
  reservationsReleased: number;
  payments: number;
  orderItems: number;
  outbox: number;
  redemptions: number;
}> {
  const q = client;
  // ۱) سفارش‌های خودم (نشان note) + سفارش‌های با کوپن خودم
  const myCoupons = await q.coupon.findMany({
    where: { code: { startsWith: "HACK67-" } },
    select: { id: true },
  });
  const couponIds = myCoupons.map((c) => c.id);

  const myOrders = await q.order.findMany({
    where: {
      OR: [{ note: "HACK67 attack" }, { couponCodeSnapshot: { startsWith: "HACK67-" } }],
    },
    select: { id: true },
  });
  const orderIds = myOrders.map((o) => o.id);

  let reservationsReleased = 0;

  if (orderIds.length > 0) {
    // ۲) رزروهای فعال سفارش‌های خودم → RELEASED + decrement شمارندهٔ reserved (مانند releaseReservation)
    const active = await q.inventoryReservation.findMany({
      where: { orderId: { in: orderIds }, status: "ACTIVE" },
      select: { id: true, variantId: true, qty: true },
    });
    for (const r of active) {
      const claimed = await q.inventoryReservation.updateMany({
        where: { id: r.id, status: "ACTIVE" },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      if (claimed.count > 0) {
        await q.variant.update({ where: { id: r.variantId }, data: { reserved: { decrement: r.qty } } });
        reservationsReleased++;
      }
    }
    // رزروهای غیرفعالِ سفارش‌های حذف‌شدنی — orderIdشان SetNull می‌شود؛ ولی تمیزتر است حذف کنیم
    const dead = await q.inventoryReservation.deleteMany({ where: { orderId: { in: orderIds }, status: { not: "ACTIVE" } } });
    reservationsReleased += dead.count;

    const payments = await q.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    const items = await q.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    const outbox = await q.$executeRawUnsafe(
      `DELETE FROM "OutboxEvent" WHERE payload->>'orderId' = ANY($1::text[])`,
      orderIds,
    );
    const redemptions = await q.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
    const orders = await q.order.deleteMany({ where: { id: { in: orderIds } } });
    var counts = { payments: payments.count, orderItems: items.count, outbox: Number(outbox), redemptions: redemptions.count, orders: orders.count };
  } else {
    var counts = { payments: 0, orderItems: 0, outbox: 0, redemptions: 0, orders: 0 };
  }

  // ۳) کوپن‌های خودم
  let coupons = 0;
  if (couponIds.length > 0) {
    const res = await q.coupon.deleteMany({ where: { id: { in: couponIds } } });
    coupons = res.count;
  }

  // ۴) کاربران خودم (نشان نام) — Session/OTP دیگران هرگز لمس نمی‌شود
  const myUsers = await q.user.deleteMany({ where: { name: { startsWith: "redteam67-" } } });

  return {
    orders: counts.orders,
    coupons,
    users: myUsers.count,
    reservationsReleased,
    payments: counts.payments,
    orderItems: counts.orderItems,
    outbox: counts.outbox,
    redemptions: counts.redemptions,
  };
}

if (import.meta.main) {
  const r = await cleanupMyRows();
  console.log("[cleanup-67] (فقط ردیف‌های HACK67/redteam67 خودم):", JSON.stringify(r));
  await db.$disconnect();
}
