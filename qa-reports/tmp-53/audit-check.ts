import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const rows = await db.auditLog.findMany({
  where: { action: "auth.login.rate_limited", entityId: "sec03-live@prima.test" },
  orderBy: { createdAt: "desc" },
  take: 2,
  select: { action: true, after: true },
});
console.log(JSON.stringify(rows, null, 1));
const failed = await db.auditLog.count({ where: { action: "auth.login.failed", entityId: "sec03-live@prima.test" } });
console.log("failed attempts audited:", failed);
await db.$disconnect();
