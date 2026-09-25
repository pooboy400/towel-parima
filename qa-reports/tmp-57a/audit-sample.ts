import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const row = await db.auditLog.findFirst({ where: { entityId: "lock57a@example.invalid", action: "auth.login.rate_limited" }, orderBy: { createdAt: "desc" }, select: { action: true, after: true, ip: true, createdAt: true } });
console.log(JSON.stringify(row));
await db.$disconnect();
