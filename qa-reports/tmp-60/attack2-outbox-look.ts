import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const f = await Bun.file(new URL("./attack2-fixture.json", import.meta.url)).json();
const evs = await db.outboxEvent.findMany({
  where: { OR: [{ payload: { path: ["orderId"], equals: f.orderId } }, { payload: { path: ["paymentId"], equals: f.paymentId } }] },
  select: { id: true, type: true, payload: true, createdAt: true },
});
console.log(JSON.stringify(evs, null, 1));
const byCode = await db.outboxEvent.findMany({
  where: { payload: { path: ["code"], equals: "unknown" } }, select: { id: true },
});
await db.$disconnect();
