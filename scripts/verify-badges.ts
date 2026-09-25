// راستی‌آزمایی مستقل برچسب‌های خودکار — قواعد ADR 011 روی دیتابیس زنده
// (عمداً بدون import از src تا محاسبه مستقل کنترل شود)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const RULES = { newDays: 14, bestsellerMinSales: 5, bestsellerWindowDays: 30, limitedMaxStock: 10 };
const SOLD = ["PROCESSING", "SHIPPED", "DELIVERED"];

async function main() {
  const since = new Date(Date.now() - RULES.bestsellerWindowDays * DAY);

  const products = await prisma.product.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: {
      slug: true,
      createdAt: true,
      variants: { select: { stock: true, reserved: true, isActive: true, deletedAt: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: { status: { in: SOLD }, placedAt: { gte: since }, payments: { none: { status: "REFUNDED" } } },
    },
    _sum: { quantity: true },
  });
  const soldMap = new Map(grouped.map((g) => [g.productId, g._sum.quantity ?? 0]));
  const idBySlug = new Map(
    (await prisma.product.findMany({ select: { id: true, slug: true } })).map((p) => [p.id, p.slug]),
  );

  console.log("slug → badges");
  for (const p of products) {
    const available = p.variants
      .filter((v) => v.isActive && !v.deletedAt)
      .reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0);
    const sold = soldMap.get([...idBySlug].find(([_, s]) => s === p.slug)?.[0] ?? "") ?? 0;
    const badges: string[] = [];
    if (sold >= RULES.bestsellerMinSales) badges.push("bestseller");
    if ((Date.now() - p.createdAt.getTime()) / DAY <= RULES.newDays) badges.push("new");
    if (available > 0 && available <= RULES.limitedMaxStock) badges.push("limited");
    console.log(`${p.slug} → [${badges.join(", ")}] (موجودی=${available}، فروش۳۰روز=${sold})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
