import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const since = new Date(Date.now() - 60 * 60 * 1000);
const evs = await db.outboxEvent.findMany({
  where: { createdAt: { gte: since } },
  select: { id: true, type: true, status: true, payload: true, createdAt: true },
  orderBy: { createdAt: "asc" },
});
console.log("count:", evs.length);
for (const e of evs) console.log(e.type, e.status, e.createdAt.toISOString(), JSON.stringify(e.payload).slice(0, 120));
await db.$disconnect();
