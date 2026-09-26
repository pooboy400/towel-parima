// Task 60-be — read-only DB look (SELECT only)
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const coupons = await db.coupon.findMany({
  select: { code: true, usageLimit: true, perUserLimit: true, usedCount: true, isActive: true, deletedAt: true },
  orderBy: { createdAt: "desc" },
  take: 20,
});
console.log(JSON.stringify(coupons, null, 1));
const redems = await db.couponRedemption.groupBy({ by: ["couponId", "userId"], _count: true });
console.log("redemptions:", JSON.stringify(redems));
await db.$disconnect();
