/**
 * Task 57-b — mint نشست‌های تستی (الگوی tmp-53/sec01-mint.ts)
 * اجرا: DATABASE_URL=... bun qa-reports/tmp-57b/mint-57b.ts mint|cleanup
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getRoleDefinition } from "../../src/core/auth/roles";
import type { SystemRoleName } from "../../src/domain/models/account";

const db = new PrismaClient();

const MINTS: { role: SystemRoleName | null; roleName: string; email: string; token: string; permissions?: string[] }[] = [
  {
    role: "SUPPORT_AGENT",
    roleName: "SUPPORT_AGENT",
    email: "support+57b@prima.test",
    token: `57btoken_support_${"a".repeat(40)}`,
  },
  {
    role: "CONTENT_MANAGER",
    roleName: "CONTENT_MANAGER",
    email: "content+57b@prima.test",
    token: `57btoken_content_${"a".repeat(40)}`,
  },
  {
    role: null, // نقش سفارشی کمینه — فقط content.read (برای آزمودن sms/notifications/dashboard بدون مجوز)
    roleName: "QA57B_MIN",
    email: "min+57b@prima.test",
    token: `57btoken_min_${"a".repeat(40)}`,
    permissions: ["content.read"],
  },
];

async function mint() {
  for (const m of MINTS) {
    let roleId: string;
    if (m.role) {
      const perms = getRoleDefinition(m.role).permissions as string[];
      const role = await db.role.upsert({
        where: { name: m.role },
        update: { isSystem: true, permissions: perms },
        create: { id: `role_${m.role.toLowerCase()}`, name: m.role, title: m.role, isSystem: true, permissions: perms },
      });
      roleId = role.id;
    } else {
      const role = await db.role.upsert({
        where: { name: m.roleName },
        update: { permissions: m.permissions! },
        create: { id: "role_qa57b_min", name: m.roleName, title: "QA 57b minimal", isSystem: false, permissions: m.permissions! },
      });
      roleId = role.id;
    }
    const user = await db.user.upsert({
      where: { email: m.email },
      update: { roleId, isActive: true, deletedAt: null },
      create: {
        email: m.email,
        phone: `0913000${Math.floor(Math.random() * 9000 + 1000)}`,
        name: `تست ${m.roleName} 57B`,
        roleId,
        isActive: true,
        passwordHash: await bcrypt.hash("x".repeat(20), 4),
      },
    });
    await db.session.deleteMany({ where: { sessionToken: m.token } });
    await db.session.create({
      data: {
        sessionToken: m.token,
        userId: user.id,
        isAdminSession: true,
        idleAt: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
    console.log(`${m.roleName}=${m.token}`);
  }
}

async function cleanup() {
  const emails = MINTS.map((m) => m.email);
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  for (const u of users) await db.session.deleteMany({ where: { userId: u.id } });
  const res = await db.user.deleteMany({ where: { email: { in: emails } } });
  const roleDel = await db.role.deleteMany({ where: { name: "QA57B_MIN", isSystem: false } });
  console.log(JSON.stringify({ cleanup: { users: res.count, customRoles: roleDel.count } }));
}

const mode = process.argv[2] ?? "mint";
if (mode === "cleanup") await cleanup();
else await mint();
await db.$disconnect();
