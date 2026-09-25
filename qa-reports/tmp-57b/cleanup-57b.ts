/** پاکسازی کامل دیتای تستی 57-b — الگوی tmp-55b/cleanup.ts + حذف نقش سفارشی */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const CODES = ["2456563800"]; // سفارش تستی 57-b
const orders = await db.order.findMany({ where: { code: { in: CODES } }, select: { id: true, code: true } });
const oids = orders.map((o) => o.id);
let stockRestored = 0, reservedReleased = 0;
const rsvs = await db.inventoryReservation.findMany({ where: { orderId: { in: oids } } });
for (const r of rsvs) {
  if (r.status === "CONVERTED") {
    await db.variant.update({ where: { id: r.variantId }, data: { stock: { increment: r.qty } } });
    stockRestored += r.qty;
  }
  const v = await db.variant.findUnique({ where: { id: r.variantId }, select: { reserved: true } });
  if (v && r.status === "ACTIVE") {
    await db.variant.update({ where: { id: r.variantId }, data: { reserved: Math.max(0, v.reserved - r.qty) } });
    reservedReleased += r.qty;
  }
}
const dRsv = oids.length ? await db.inventoryReservation.deleteMany({ where: { orderId: { in: oids } } }) : { count: 0 };
const dPay = await db.payment.deleteMany({ where: { order: { code: { in: CODES } } } });
const dItem = await db.orderItem.deleteMany({ where: { orderId: { in: oids } } });
const dOut = await db.$executeRaw`DELETE FROM "OutboxEvent" WHERE "payload"::text LIKE '%2456563800%'`;
const dSms = await db.smsLog.deleteMany({ where: { OR: [{ phone: "09125550042" }, { to: "09125550042" }] } }).catch(() => ({ count: 0 }));
const dOrd = await db.order.deleteMany({ where: { code: { in: CODES } } });
// نشست‌های mint 57-b
const emails = ["support+57b@prima.test", "content+57b@prima.test", "min+57b@prima.test"];
const us = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
for (const u of us) await db.session.deleteMany({ where: { userId: u.id } });
const dUsr = await db.user.deleteMany({ where: { email: { in: emails } } });
const dRole = await db.role.deleteMany({ where: { name: "QA57B_MIN", isSystem: false } }).catch(() => ({ count: 0 }));
console.log(JSON.stringify({
  orders: dOrd.count, items: dItem.count, payments: dPay.count, reservations: dRsv.count,
  outbox: dOut, sms: dSms.count ?? 0, stockRestored, reservedReleased,
  users: dUsr.count, customRoles: dRole.count ?? 0,
}));
await db.$disconnect();
