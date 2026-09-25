import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const orderLeft = await db.order.count({ where: { code: "8687459998" } });
const paymentLeft = await db.payment.count({ where: { order: { code: "8687459998" } } });
const reservedVariants = await db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "Variant" WHERE "reserved" > 0`;
const activeReservations = await db.inventoryReservation.count({ where: { status: "ACTIVE" } });
const mintedLeft = await db.user.count({ where: { email: { contains: "57a" } } });
const mintedSessionsLeft = await db.session.count({ where: { sessionToken: { startsWith: "sec57a_" } } });
const auditLeft = await db.auditLog.count({ where: { entityId: "lock57a@example.invalid" } });
const realAdmin = await db.user.findUnique({ where: { email: "admin@prima-store.ir" }, select: { email: true, isActive: true } });
console.log(JSON.stringify({
  orderLeft, paymentLeft,
  variantsWithReservedNotZero: reservedVariants[0].n,
  activeReservationsLeft: activeReservations,
  mintedUsersLeft: mintedLeft, mintedSessionsLeft, auditLeft,
  realAdminIntact: realAdmin?.email === "admin@prima-store.ir" && realAdmin?.isActive === true,
}, null, 1));
await db.$disconnect();
