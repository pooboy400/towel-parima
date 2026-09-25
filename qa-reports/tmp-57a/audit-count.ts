import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const email = process.argv[2] ?? "lock57a@example.invalid";
const rows = await db.auditLog.groupBy({ by: ["action"], where: { entityId: email }, _count: { action: true } });
const perEmail = await db.auditLog.count({ where: { entityId: email, action: "auth.login.rate_limited", after: { path: ["scope"], equals: "per-email" } } });
const perIp = await db.auditLog.count({ where: { entityId: email, action: "auth.login.rate_limited", after: { path: ["scope"], equals: "per-ip" } } });
const total = await db.auditLog.count({ where: { entityId: email } });
console.log(JSON.stringify({ email, total, byAction: rows, perEmailScoped: perEmail, perIpScoped: perIp }, null, 1));
await db.$disconnect();
