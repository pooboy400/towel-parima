/**
 * پاکسازی کامل دیتای تستی 57-a (فقط ردیف‌های ساخته‌شده توسط این ایجنت)
 * اجرا: cd /home/z/my-project/towel-parima && DATABASE_URL="$(bash scripts/pg.sh url)" bun qa-reports/tmp-57a/cleanup.ts
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const ORDER_CODE = "8687459998";
const ORDER_PHONE = "09135701234"; // گارد ضدخطا: سفارش دیگری پاک نشود
const AUDIT_EMAIL = "lock57a@example.invalid";
const MINTED_EMAILS = [
  "sec01-57a+super_admin@prima.test",
  "sec01-57a+support_agent@prima.test",
  "sec01-57a+store_manager@prima.test",
];

const order = await db.order.findFirst({
  where: { code: ORDER_CODE, phone: ORDER_PHONE },
  select: { id: true },
});
if (!order) throw new Error("سفارش تستی یافت نشد — پاکسازی متوقف شد");
const oid = order.id;

// ۱) رخدادهای Outbox متعلق به همین سفارش
const events = await db.outboxEvent.findMany({
  where: { type: { contains: "Order" } },
  select: { id: true, payload: true },
});
const evIds = events.filter((e) => JSON.stringify(e.payload).includes(oid)).map((e) => e.id);
const outbox = evIds.length
  ? await db.outboxEvent.deleteMany({ where: { id: { in: evIds } } })
  : { count: 0 };

// ۲) پیامک‌های سفارش تستی
const sms = await db.smsLog.deleteMany({ where: { orderId: oid } });

// ۳) پرداخت PENDING
const pay = await db.payment.deleteMany({ where: { orderId: oid, status: "PENDING" } });

// ۴) اقلام و رزروها + بازسازی reserved واریانت‌ها
const items = await db.orderItem.deleteMany({ where: { orderId: oid } });
const reservations = await db.inventoryReservation.findMany({
  where: { orderId: oid },
  select: { id: true, variantId: true },
});
await db.inventoryReservation.deleteMany({ where: { orderId: oid } });
let reservedFixed = 0;
for (const vid of [...new Set(reservations.map((r) => r.variantId))]) {
  const active = await db.inventoryReservation.aggregate({
    where: { variantId: vid, status: "ACTIVE" },
    _sum: { qty: true },
  });
  await db.$executeRaw`UPDATE "Variant" SET "reserved" = ${active._sum.qty ?? 0} WHERE "id" = ${vid}`;
  reservedFixed++;
}

// ۵) خودِ سفارش
const ord = await db.order.delete({ where: { id: oid } });

// ۶) ردیف‌های audit تستی SEC-03 (۶ ردیف ایمیل آزمایشی)
const audit = await db.auditLog.deleteMany({
  where: { entityId: AUDIT_EMAIL, action: { in: ["auth.login.failed", "auth.login.rate_limited"] } },
});

// ۷) کاربران/نشست‌های mint‌شدهٔ SEC-01
const users = await db.user.findMany({ where: { email: { in: MINTED_EMAILS } }, select: { id: true } });
let sessions = { count: 0 };
for (const u of users) sessions = await db.session.deleteMany({ where: { userId: u.id } });
const delUsers = await db.user.deleteMany({ where: { email: { in: MINTED_EMAILS } } });

console.log(
  JSON.stringify(
    {
      order: ord.code,
      outboxEvents: outbox.count,
      sms: sms.count,
      payments: pay.count,
      orderItems: items.count,
      reservations: reservations.length,
      reservedRecomputedVariants: reservedFixed,
      auditDeleted: audit.count,
      mintedSessions: sessions.count,
      mintedUsers: delUsers.count,
    },
    null,
    1,
  ),
);
await db.$disconnect();
