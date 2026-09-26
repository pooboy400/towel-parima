import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const f = await Bun.file(new URL("./attack2-fixture.json", import.meta.url)).json();
const all = await db.outboxEvent.findMany({
  orderBy: { createdAt: "desc" },
  take: 25,
  select: { type: true, status: true, createdAt: true, payload: true },
});
console.log("== last 25 outbox events (any time):");
for (const e of all) console.log(e.type, e.status, e.createdAt.toISOString(), JSON.stringify(e.payload).slice(0, 100));
const order = await db.order.findUniqueOrThrow({ where: { id: f.orderId }, select: { status: true, createdAt: true, updatedAt: true } });
console.log("== my order:", JSON.stringify(order));
const sms = await db.smsLog.findMany({ where: { createdAt: { gte: new Date(Date.now() - 3600_000) } }, select: { to: true, tag: true, status: true, createdAt: true, orderId: true } });
console.log("== smsLog last hour:", JSON.stringify(sms));
await db.$disconnect();
