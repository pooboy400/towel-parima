/**
 * SEC-01 live verify (55-a) — mint نشست برای ۳ نقش: SUPER_ADMIN / SUPPORT_AGENT / STORE_MANAGER
 * هش رمز از ادمین موجود کپی می‌شود (بدون دانستن/تغییر رمز ادمین واقعی).
 * اجرا: cd /home/z/my-project/towel-parima && DATABASE_URL="$(bash scripts/pg.sh url)" bun qa-reports/tmp-55a/mint.ts mint|cleanup
 */
import { PrismaClient } from "@prisma/client";
import { getRoleDefinition } from "../../src/core/auth/roles";
import type { SystemRoleName } from "../../src/domain/models/account";

const db = new PrismaClient();

const ROLES: SystemRoleName[] = ["SUPER_ADMIN", "SUPPORT_AGENT", "STORE_MANAGER"];
const emailOf = (r: string) => `sec01-55a+${r.toLowerCase()}@prima.test`;

async function mint() {
  const admin = await db.user.findUnique({
    where: { email: "admin@prima-store.ir" },
    select: { passwordHash: true },
  });
  if (!admin?.passwordHash) throw new Error("ادمین مرجع یافت نشد");

  for (const roleName of ROLES) {
    const perms = getRoleDefinition(roleName).permissions as string[];
    const role = await db.role.upsert({
      where: { name: roleName },
      update: { isSystem: true, permissions: perms },
      create: { id: `role_${roleName.toLowerCase()}`, name: roleName, title: roleName, isSystem: true, permissions: perms },
    });
    const email = emailOf(roleName);
    const user = await db.user.upsert({
      where: { email },
      update: { roleId: role.id, isActive: true, deletedAt: null },
      create: {
        email,
        phone: `0913550${Math.floor(Math.random() * 9000 + 1000)}`,
        name: `تست 55a ${roleName}`,
        roleId: role.id,
        isActive: true,
        passwordHash: admin.passwordHash, // کپی هش ادمین موجود — نه رمز جدید
      },
    });
    const token = `sec55a_${roleName.toLowerCase()}_${"b".repeat(38)}`;
    await db.session.deleteMany({ where: { sessionToken: token } });
    await db.session.create({
      data: {
        sessionToken: token,
        userId: user.id,
        isAdminSession: true,
        idleAt: new Date(Date.now() - 1000), // فعال (idle-slide روی سرور محاسبه می‌شود)
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
    console.log(`${roleName}=${token}`);
  }
}

async function cleanup() {
  const emails = ROLES.map((r) => emailOf(r));
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  for (const u of users) await db.session.deleteMany({ where: { userId: u.id } });
  const res = await db.user.deleteMany({ where: { email: { in: emails } } });
  console.log(`cleanup: users=${res.count}`);
}

const mode = process.argv[2] ?? "mint";
if (mode === "cleanup") await cleanup();
else await mint();
await db.$disconnect();
