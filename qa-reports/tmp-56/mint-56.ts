/**
 * mint-56 — اثبات زندهٔ گیت داشبورد (CR-1/Task 56)
 * نشست SUPPORT_AGENT و SUPER_ADMIN می‌سازد؛ توکن‌ها چاپ می‌شوند؛ بعد cleanup.
 */
import { PrismaClient } from "@prisma/client";
import { newSessionExpiry } from "../../src/domain/policies/session";

const db = new PrismaClient();
const TAG = `qa56-${Date.now().toString(36)}`;

async function mintSession(roleName: string, useExistingRole: boolean) {
  let roleId: string;
  if (useExistingRole) {
    const role = await db.role.findUnique({ where: { name: roleName } });
    if (!role) throw new Error(`role ${roleName} not found`);
    roleId = role.id;
  } else {
    const role = await db.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        id: `role_${roleName.toLowerCase()}_${TAG}`,
        name: roleName,
        title: roleName,
        isSystem: true,
        permissions: [
          "products.read",
          "orders.read",
          "customers.read",
          "customers.update",
          "reviews.read",
        ],
      },
    });
    roleId = role.id;
  }
  const user = await db.user.create({
    data: {
      email: `qa56-${roleName.toLowerCase()}@${TAG}.test`,
      phone: `0935${Date.now().toString().slice(-7)}`,
      name: `تست ۵۶ ${roleName}`,
      roleId,
      isActive: true,
      passwordHash: "x".repeat(20),
    },
  });
  const token = `qa56token_${roleName}_${TAG}${"0".repeat(16)}`;
  await db.session.create({
    data: {
      sessionToken: token,
      userId: user.id,
      isAdminSession: true,
      idleAt: new Date(),
      expiresAt: newSessionExpiry(true),
    },
  });
  return { token, userEmail: user.email };
}

const support = await mintSession("SUPPORT_AGENT", false);
const adminUser = await db.user.findUnique({ where: { email: "admin@prima-store.ir" } });
let adminToken = "";
if (adminUser) {
  adminToken = `qa56token_admin_${TAG}${"0".repeat(16)}`;
  await db.session.create({
    data: {
      sessionToken: adminToken,
      userId: adminUser.id,
      isAdminSession: true,
      idleAt: new Date(),
      expiresAt: newSessionExpiry(true),
    },
  });
}
console.log(JSON.stringify({ tag: TAG, support: support.token, admin: adminToken }));
await db.$disconnect();
