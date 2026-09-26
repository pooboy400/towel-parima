import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public" } } });
const nullOrders = await db.order.findMany({ where: { userId: null }, select: { code: true, phone: true, status: true, createdAt: true } });
const users = await db.user.findMany({ select: { phone: true, createdAt: true, role: { select: { name: true } } } });
console.log(JSON.stringify({ nullOrders, users }, null, 1));
await db.$disconnect();
