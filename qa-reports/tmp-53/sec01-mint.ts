/**
 * SEC-01 live verify — mint session برای SUPPORT_AGENT و SUPER_ADMIN
 * اجرا: DATABASE_URL=... bun qa-reports/tmp-53/sec01-mint.ts mint|cleanup
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getRoleDefinition } from "../../src/core/auth/roles";
import type { SystemRoleName } from "../../src/domain/models/account";

const db = new PrismaClient();

const EMAILS = {
  SUPPORT_AGENT: "support+sec01@prima.test",
  SUPER_ADMIN: "super+sec01@prima.test",
};

async function mint() {
  for (const [roleName, email] of Object.entries(EMAILS)) {
    const perms = getRoleDefinition(roleName as SystemRoleName).permissions as string[];
    const role = await db.role.upsert({
      where: { name: roleName },
      update: { isSystem: true, permissions: perms },
      create: {
        id: `role_${roleName.toLowerCase()}`,
        name: roleName,
        title: roleName,
        isSystem: true,
        permissions: perms,
      },
    });
    const user = await db.user.upsert({
      where: { email },
      update: { roleId: role.id, isActive: true, deletedAt: null },
      create: {
        email,
        phone: `0913000${Math.floor(Math.random() * 9000 + 1000)}`,
        name: `تست ${roleName} SEC01`,
        roleId: role.id,
        isActive: true,
        passwordHash: await bcrypt.hash("x".repeat(20), 4),
      },
    });
    const token = `sec01token_${roleName.toLowerCase()}_${"a".repeat(40)}`;
    await db.session.deleteMany({ where: { sessionToken: token } });
    await db.session.create({
      data: {
        sessionToken: token,
        userId: user.id,
        isAdminSession: true,
        idleAt: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
    console.log(`${roleName}=${token}`);
  }
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { in: Object.values(EMAILS) } },
    select: { id: true },
  });
  for (const u of users) {
    await db.session.deleteMany({ where: { userId: u.id } });
  }
  const res = await db.user.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
  console.log(`cleanup: users=${res.count}`);
}

const mode = process.argv[2] ?? "mint";
if (mode === "cleanup") await cleanup();
else await mint();
await db.$disconnect();
