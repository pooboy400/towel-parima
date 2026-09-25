/** پاکسازی کامل دیتای تستی 55-b — الگو: tmp-51d/cleanup.ts */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const CODES = ["4538715669", "9061028310"];
const orders = await db.order.findMany({ where: { code: { in: CODES } }, select: { id: true, code: true } });
const oids = orders.map((o) => o.id);
// ۱) بازگردانی واریانت‌ها: CONVERTED → stock+qty (پرداخت تأییدشده موجودی را کم کرد) ؛ ACTIVE → فقط reserved آزاد شود
const rsvs = await db.inventoryReservation.findMany({ where: { orderId: { in: oids } } });
let stockRestored = 0, reservedReleased = 0;
for (const r of rsvs) {
  if (r.status === "CONVERTED") {
    await db.variant.update({ where: { id: r.variantId }, data: { stock: { increment: r.qty } } });
    stockRestored += r.qty;
  }
  // رزرو فعال هم reserved دارد که با حذف رزرو باید دستی آزاد شود
  const v = await db.variant.findUnique({ where: { id: r.variantId }, select: { reserved: true } });
  if (v && r.status === "ACTIVE") { await db.variant.update({ where: { id: r.variantId }, data: { reserved: Math.max(0, v.reserved - r.qty) } }); reservedReleased += r.qty; }
}
// ۲) حذف رکوردهای سفارش
const dRsv = await db.inventoryReservation.deleteMany({ where: { orderId: { in: oids } } });
const dPay = await db.payment.deleteMany({ where: { order: { code: { in: CODES } } } });
const dItem = await db.orderItem.deleteMany({ where: { orderId: { in: oids } } });
const dOut = await db.$executeRaw`DELETE FROM "OutboxEvent" WHERE "payload"::text LIKE '%4538715669%' OR "payload"::text LIKE '%9061028310%'`;
const dOrd = await db.order.deleteMany({ where: { code: { in: CODES } } });
// ۳) پاکسازی نشست‌های mint شدهٔ sec01 (الگوی tmp-53)
const emails = ["support+sec01@prima.test", "super+sec01@prima.test"];
const us = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
for (const u of us) await db.session.deleteMany({ where: { userId: u.id } });
const dUsr = await db.user.deleteMany({ where: { email: { in: emails } } });
const dRole = await db.role.deleteMany({ where: { id: { in: ["role_support_agent", "role_super_admin"] }, users: { none: { id: { notIn: [] } } } } }).catch(() => ({ count: 0 }));
console.log(JSON.stringify({ orders: dOrd.count, items: dItem.count, payments: dPay.count, reservations: dRsv.count, outbox: dOut, stockRestored, reservedReleased, sec01Users: dUsr.count, sec01Roles: dRole.count ?? 0 }));
await db.$disconnect();
