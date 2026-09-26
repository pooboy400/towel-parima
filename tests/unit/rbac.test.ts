import { describe, expect, it } from "bun:test";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  type Permission,
} from "../../src/core/auth/permissions";
import { getRoleDefinition, roleHas, ROLE_DEFINITIONS } from "../../src/core/auth/roles";

/** ماتریس مرجع — مستقیم از بخش ۶.۳ سند معماری (نه از کد نقش‌ها) */
const EXPECTED: Record<string, readonly string[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  STORE_MANAGER: [
    "products.read", "products.create", "products.update", "products.delete",
    "inventory.read", "inventory.update",
    "orders.read", "orders.update", "orders.refund",
    "customers.read", "customers.update",
    "coupons.read", "coupons.create", "coupons.update", "coupons.delete",
    "reviews.read", "reviews.moderate",
    "content.read",
    "media.read", "media.upload", "media.delete",
    "analytics.read",
    "settings.read",
  
    "profile.self", // INFRA-08/2 — self-service
  ],
  ORDER_MANAGER: [
    "products.read",
    "orders.read", "orders.update", "orders.refund",
    "customers.read",
    "analytics.read",
  
    "profile.self", // INFRA-08/2 — self-service
  ],
  CONTENT_MANAGER: [
    "products.read",
    "content.read", "content.update",
    "reviews.read", "reviews.moderate",
    "media.read", "media.upload", "media.delete",
    "analytics.read",
  
    "profile.self", // INFRA-08/2 — self-service
  ],
  SUPPORT_AGENT: [
    "products.read",
    "orders.read",
    "customers.read", "customers.update",
    "reviews.read",
  
    "profile.self", // INFRA-08/2 — self-service
  ],
  MARKETING_MANAGER: [
    "products.read",
    "coupons.read", "coupons.create", "coupons.update", "coupons.delete",
    "reviews.read",
    "content.read",
    "analytics.read",
  
    "profile.self", // INFRA-08/2 — self-service
  ],
};

describe("فهرست کانونی مجوزها — بخش ۶.۲ سند", () => {
  it("دقیقاً ۲۹ مجوز دارد (INFRA-08/2: profile.self اضافه شد)", () => {
    expect(ALL_PERMISSIONS.length).toBe(29);
  });

  it("بدون تکرار", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(29);
  });

  it("همه با الگوی entity.action هستند", () => {
    for (const p of ALL_PERMISSIONS) {
      expect(p).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });
});

describe("ماتریس RBAC — هر نقش × هر مجوز", () => {
  it("۶ نقش سیستمی تعریف شده است", () => {
    expect(ROLE_DEFINITIONS.length).toBe(6);
  });

  for (const [roleName, expectedPerms] of Object.entries(EXPECTED)) {
    it(`${roleName}: دقیقاً مجوزهای سند`, () => {
      const role = getRoleDefinition(roleName as never);
      expect([...role.permissions].sort()).toEqual([...expectedPerms].sort());
    });
  }

  it("هیچ نقشی مجوز خارج از فهرست کانونی ندارد", () => {
    const canonical = new Set<string>(ALL_PERMISSIONS);
    for (const role of ROLE_DEFINITIONS) {
      for (const p of role.permissions) {
        expect(canonical.has(p)).toBe(true);
      }
    }
  });

  it("نقش‌های غیر SUPER_ADMIN هرگز users/audit ندارند", () => {
    for (const role of ROLE_DEFINITIONS) {
      if (role.name === "SUPER_ADMIN") continue;
      expect(role.permissions).not.toContain(PERMISSIONS.usersRead);
      expect(role.permissions).not.toContain(PERMISSIONS.usersUpdate);
      expect(role.permissions).not.toContain(PERMISSIONS.auditRead);
      expect(role.permissions).not.toContain(PERMISSIONS.settingsUpdate);
    }
  });

  it("roleHas برای customer (null) همیشه false است", () => {
    expect(roleHas(null, PERMISSIONS.productsRead)).toBe(false);
    expect(roleHas(null, PERMISSIONS.analyticsRead)).toBe(false);
  });

  it("نمونه‌های سند: ORDER_MANAGER refund دارد اما CONTENT_MANAGER ندارد", () => {
    expect(roleHas("ORDER_MANAGER", PERMISSIONS.ordersRefund)).toBe(true);
    expect(roleHas("CONTENT_MANAGER", PERMISSIONS.ordersRefund)).toBe(false);
    expect(roleHas("SUPPORT_AGENT", PERMISSIONS.customersUpdate)).toBe(true);
    expect(roleHas("SUPPORT_AGENT", PERMISSIONS.ordersUpdate)).toBe(false);
  });
});
