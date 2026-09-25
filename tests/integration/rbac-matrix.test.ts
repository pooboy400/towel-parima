/**
 * Integration — ماتریس RBAC روی DB واقعی (DoD بخش ۲۷ سند)
 * ---------------------------------------------------------------
 * شرط پذیرش M2: «تست integration ماتریس RBAC سبز · هر mutation ادمین audited»
 * اجرا: DATABASE_URL=... bun test tests/integration
 * اگر دیتابیس در دسترس نباشد، skip می‌شود.
 */

import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { requirePermission, authenticate } from "../../src/core/auth/guard";
import { DomainError, isDomainError } from "../../src/core/errors";
import { PERMISSIONS, ALL_PERMISSIONS } from "../../src/core/auth/permissions";
import { ROLE_DEFINITIONS, getRoleDefinition } from "../../src/core/auth/roles";
import {
  ADMIN_PAGE_READ_MAP,
  canAccessAdminPage,
  type AdminPageRoute,
} from "../../src/lib/admin/page-read-map";
import { dbSessionReader } from "../../src/core/auth/db-session-reader";
import { PrismaAuditWriter } from "../../src/core/audit/prisma-writer";
import { isSessionValid, newSessionExpiry } from "../../src/domain/policies/session";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";

const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

let dbUp = false;

async function seedRoleSession(roleName: string, permissions: string[]) {
  const role = await db.role.upsert({
    where: { name: roleName },
    update: { permissions, isSystem: true, title: roleName },
    create: { id: `test_role_${roleName}`, name: roleName, title: roleName, isSystem: true, permissions },
  });
  const email = `${roleName.toLowerCase()}+rbactest@prima.test`;
  const user = await db.user.upsert({
    where: { email },
    update: { roleId: role.id, isActive: true, deletedAt: null },
    create: {
      email,
      phone: `0911000${Math.floor(Math.random() * 9000 + 1000)}`,
      name: `تست ${roleName}`,
      roleId: role.id,
      isActive: true,
      passwordHash: await bcrypt.hash("x".repeat(20), 4),
    },
  });
  const token = `testtoken_${roleName}_${Math.random().toString(36).slice(2)}${"0".repeat(20)}`;
  await db.session.create({
    data: {
      sessionToken: token,
      userId: user.id,
      isAdminSession: true,
      idleAt: new Date(),
      expiresAt: newSessionExpiry(true),
    },
  });
  return token;
}

beforeAll(async () => {
  try {
    await db.$queryRaw`SELECT 1`;
    dbUp = true;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  if (!dbUp) return;
  await db.user.deleteMany({ where: { email: { endsWith: "+rbactest@prima.test" } } });
  await db.$disconnect();
});

describe("RBAC ماتریس روی DB واقعی", () => {
  it(
    "read-matrix صفحات ادمین (SEC-01) — هر نقش فقط صفحات مجاز read را می‌بیند",
    async () => {
      if (!dbUp) return console.log("skip: DB در دسترس نیست");

      // ۱) سلامت نقشه: همهٔ مجوزهای نقشه در فهرست کانونی مجوزها هستند
      for (const perms of Object.values(ADMIN_PAGE_READ_MAP)) {
        for (const p of perms) expect(ALL_PERMISSIONS).toContain(p);
      }

      // ۲) شرط پذیرش SEC-01 — نقش SUPPORT_AGENT:
      //    staff / audit / settings / journal / media / faq را نبیند؛
      //    orders / messages / products / reviews / categories را ببیند
      const support = getRoleDefinition("SUPPORT_AGENT").permissions as string[];
      expect(canAccessAdminPage(support, "staff")).toBe(false);
      expect(canAccessAdminPage(support, "audit")).toBe(false);
      expect(canAccessAdminPage(support, "settings")).toBe(false);
      expect(canAccessAdminPage(support, "journal")).toBe(false);
      expect(canAccessAdminPage(support, "media")).toBe(false);
      expect(canAccessAdminPage(support, "faq")).toBe(false);
      expect(canAccessAdminPage(support, "orders")).toBe(true);
      expect(canAccessAdminPage(support, "messages")).toBe(true);
      expect(canAccessAdminPage(support, "products")).toBe(true);
      expect(canAccessAdminPage(support, "reviews")).toBe(true);
      expect(canAccessAdminPage(support, "categories")).toBe(true);
      expect(canAccessAdminPage(support, "collections")).toBe(true);
      // صفحات اضافه‌شدهٔ Task 56 (CR-1/CR-8 از 55-c): داشبورد با analyticsRead —
      // SUPPORT_AGENT ندارد (نشتی KPI/ارزش انبار اثبات 55-b)؛ sms با ordersRead
      // و notifications با reviewsRead دارد
      expect(canAccessAdminPage(support, "dashboard")).toBe(false);
      expect(canAccessAdminPage(support, "sms")).toBe(true);
      expect(canAccessAdminPage(support, "notifications")).toBe(true);

      // ۳) CONTENT_MANAGER — محتوا بله؛ سفارش/کارکنان/تنظیمات/پیام خصوصی مشتری خیر
      const content = getRoleDefinition("CONTENT_MANAGER").permissions as string[];
      expect(canAccessAdminPage(content, "journal")).toBe(true);
      expect(canAccessAdminPage(content, "faq")).toBe(true);
      expect(canAccessAdminPage(content, "media")).toBe(true);
      expect(canAccessAdminPage(content, "reviews")).toBe(true);
      expect(canAccessAdminPage(content, "orders")).toBe(false);
      expect(canAccessAdminPage(content, "staff")).toBe(false);
      expect(canAccessAdminPage(content, "settings")).toBe(false);
      expect(canAccessAdminPage(content, "messages")).toBe(false);
      // CONTENT_MANAGER analyticsRead دارد → داشبورد می‌بیند (CR-1)
      expect(canAccessAdminPage(content, "dashboard")).toBe(true);

      // ۴) STORE_MANAGER — سفارش و تنظیمات بله؛ کارکنان/audit خیر
      const store = getRoleDefinition("STORE_MANAGER").permissions as string[];
      expect(canAccessAdminPage(store, "orders")).toBe(true);
      expect(canAccessAdminPage(store, "settings")).toBe(true);
      expect(canAccessAdminPage(store, "messages")).toBe(true);
      expect(canAccessAdminPage(store, "staff")).toBe(false);
      expect(canAccessAdminPage(store, "audit")).toBe(false);
      // STORE_MANAGER analyticsRead دارد → داشبورد (CR-1)
      expect(canAccessAdminPage(store, "dashboard")).toBe(true);

      // ۵) SUPER_ADMIN همه را می‌بیند
      const superAdmin = getRoleDefinition("SUPER_ADMIN").permissions as string[];
      for (const route of Object.keys(ADMIN_PAGE_READ_MAP) as AdminPageRoute[]) {
        expect(canAccessAdminPage(superAdmin, route)).toBe(true);
      }

      // ۶) اجرای زنده روی DB — گارد requirePermission پشت نقشه:
      //    نشست SUPPORT_AGENT برای usersRead (صفحهٔ staff) باید FORBIDDEN بدهد
      const supportPerms = getRoleDefinition("SUPPORT_AGENT").permissions as string[];
      const token = await seedRoleSession("SUPPORT_AGENT", supportPerms);
      let threw = false;
      try {
        await requirePermission(PERMISSIONS.usersRead, {
          sessionReader: dbSessionReader,
          token,
        });
      } catch (e) {
        threw = true;
        expect(isDomainError(e) && e.code === "FORBIDDEN").toBe(true);
      }
      expect(threw).toBe(true);

      // و همان نشست برای ordersRead (صفحهٔ سفارش‌ها) باید عبور کند
      const okActor = await requirePermission(PERMISSIONS.ordersRead, {
        sessionReader: dbSessionReader,
        token,
      });
      expect(okActor.role).toBe("SUPPORT_AGENT");
    },
    30_000,
  );

  it(
    "هر نقش با requirePermission دقیقاً مطابق ROLE_DEFINITIONS رفتار می‌کند",
    async () => {
      if (!dbUp) return console.log("skip: DB در دسترس نیست");

      const samples: Record<string, string[]> = {
        SUPER_ADMIN: ROLE_DEFINITIONS[0].permissions as string[],
        STORE_MANAGER: ROLE_DEFINITIONS[1].permissions as string[],
        CONTENT_MANAGER: (ROLE_DEFINITIONS.find((r) => r.name === "CONTENT_MANAGER")?.permissions ?? []) as string[],
        NO_ACCESS: [],
      };

      for (const [roleName, permissions] of Object.entries(samples)) {
        const token = await seedRoleSession(roleName, permissions);
        const actor = await authenticate({ sessionReader: dbSessionReader, token });
        expect(actor.role).toBe(roleName);

        // حُکم روی مجوز حساس: settings.update فقط SUPER_ADMIN
        if (permissions.includes(PERMISSIONS.settingsUpdate)) {
          const a = await requirePermission(PERMISSIONS.settingsUpdate, {
            sessionReader: dbSessionReader,
            token,
          });
          expect(a.userId.length > 0).toBe(true);
        } else {
          let threw = false;
          try {
            await requirePermission(PERMISSIONS.settingsUpdate, { sessionReader: dbSessionReader, token });
          } catch (e) {
            threw = true;
            expect(isDomainError(e) && e.code === "FORBIDDEN").toBe(true);
          }
          expect(threw).toBe(true);
        }

        // products.create — STORE_MANAGER/SUPER_ADMIN بله، بقیه خیر
        const canCreate = permissions.includes(PERMISSIONS.productsCreate);
        if (canCreate) {
          await requirePermission(PERMISSIONS.productsCreate, { sessionReader: dbSessionReader, token });
        } else {
          let threw = false;
          try {
            await requirePermission(PERMISSIONS.productsCreate, { sessionReader: dbSessionReader, token });
          } catch {
            threw = true;
          }
          expect(threw).toBe(true);
        }
      }
    },
    30_000,
  );

  it(
    "نشست ادمین idle-منقضی revoke و 401 می‌گیرد",
    async () => {
      if (!dbUp) return console.log("skip: DB در دسترس نیست");
      const role = await db.role.upsert({
        where: { name: "SUPER_ADMIN" },
        update: {},
        create: { id: "role_super_admin", name: "SUPER_ADMIN", title: "مدیر ارشد", isSystem: true, permissions: [] },
      });
      const email = "idletest+rbactest@prima.test";
      const user = await db.user.upsert({
        where: { email },
        update: { roleId: role.id, isActive: true, deletedAt: null },
        create: {
          email,
          phone: `0912000${Math.floor(Math.random() * 9000 + 1000)}`,
          name: "تست idle",
          roleId: role.id,
          isActive: true,
        },
      });
      const token = `testtoken_idle_${Math.random().toString(36).slice(2)}${"0".repeat(20)}`;
      const thirtyOneMinAgo = new Date(Date.now() - 31 * 60_000);
      const session = await db.session.create({
        data: {
          sessionToken: token,
          userId: user.id,
          isAdminSession: true,
          idleAt: thirtyOneMinAgo,
          expiresAt: newSessionExpiry(true),
        },
      });

      expect(
        isSessionValid({
          expiresAt: session.expiresAt,
          revokedAt: null,
          isAdminSession: true,
          idleAt: thirtyOneMinAgo,
        }),
      ).toBe(false);

      const got = await dbSessionReader.getSession(token);
      expect(got).toBeNull();
      const after = await db.session.findUnique({ where: { id: session.id } });
      expect(after?.revokedAt).not.toBeNull();
    },
    20_000,
  );

  it(
    "AuditWriter دیتابیسی append می‌کند و داده حساس را scrub می‌کند",
    async () => {
      if (!dbUp) return console.log("skip: DB در دسترس نیست");
      const writer = new PrismaAuditWriter();
      await writer.append({
        actorId: null,
        action: "test.audit.entry",
        entityType: "test",
        entityId: "rbac-integration",
        before: { password: "topsecret", value: 1 },
        after: { token: "abc", note: "safe" },
      });
      const row = await db.auditLog.findFirst({
        where: { action: "test.audit.entry", entityId: "rbac-integration" },
        orderBy: { createdAt: "desc" },
      });
      expect(row).not.toBeNull();
      const after = row?.after as Record<string, unknown>;
      expect(after.password).toBeUndefined();
      expect(after.note).toBe("safe");
      const before = row?.before as Record<string, unknown>;
      expect(before.password).toBe("[redacted]");
      await db.auditLog.delete({ where: { id: row!.id } });
    },
    20_000,
  );

  it(
    "توکن کوتاه/ناموجود → UNAUTHENTICATED",
    async () => {
      if (!dbUp) return console.log("skip: DB در دسترس نیست");
      let threw = false;
      try {
        await authenticate({ sessionReader: dbSessionReader, token: "short" });
      } catch (e) {
        threw = true;
        expect(isDomainError(e) && e.code === "UNAUTHENTICATED").toBe(true);
      }
      expect(threw).toBe(true);
    },
    10_000,
  );
});
