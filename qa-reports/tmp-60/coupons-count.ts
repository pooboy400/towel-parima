import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const total = await db.coupon.count();
const testLeftovers = await db.coupon.count({ where: { code: { startsWith: "CC-" } } });
const real = await db.coupon.findMany({
  where: { code: { not: { startsWith: "CC-" } } },
  select: { code: true, usageLimit: true, perUserLimit: true, usedCount: true, isActive: true },
});
const orders = await db.order.count();
console.log(JSON.stringify({ total, testLeftovers, real, orders }, null, 1));
await db.$disconnect();
