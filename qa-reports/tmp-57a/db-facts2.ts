import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const variants = await db.variant.findMany({ where: { isActive: true, stock: { gt: 0 } }, select: { id: true, stock: true, reserved: true }, take: 5 });
const p1v = await db.variant.findMany({ where: { productId: "p1" }, select: { id: true, isActive: true, stock: true, reserved: true } });
console.log(JSON.stringify({ p1v, variants }, null, 1));
await db.$disconnect();
