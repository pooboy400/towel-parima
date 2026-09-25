import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const v = await db.variant.findFirst({ where: { productId: "p1", isActive: true, stock: { gt: 0 }, reserved: 0 }, select: { id: true, productId: true, colorId: true, sizeId: true, stock: true, reserved: true, price: true } });
const prod = await db.product.findUnique({ where: { id: "p1" }, select: { status: true, deletedAt: true, name: true } });
console.log(JSON.stringify({ v, prod, lineId: v ? `${v.productId}__${v.colorId ?? "-"}__${v.sizeId ?? "-"}` : null }, null, 1));
await db.$disconnect();
