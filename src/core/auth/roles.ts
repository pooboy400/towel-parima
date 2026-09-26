/**
 * RBAC — ماتریس نقش‌ها (بخش ۶.۳ سند معماری)
 * ---------------------------------------------------------------
 * نقش customer (roleId=NULL) اینجا تعریف نمی‌شود — به پنل ادمین هیچ
 * دسترسی ندارد و فقط صفحات حساب کاربری را می‌بیند.
 * 🔵read در سند = فقط مجوزهای read آن گروه.
 */

import { PERMISSIONS, type Permission } from "./permissions";
import type { SystemRoleName } from "@/domain/models/account";

export interface RoleDefinition {
  name: SystemRoleName;
  title: string;
  permissions: readonly Permission[];
  /** نقش‌های سیستمی حذف‌شدنی نیستند */
  isSystem: true;
}

/** همه مجوزهای read یک گروه (🔵read سند) */
const readOf = (entity: string): Permission[] =>
  (Object.values(PERMISSIONS) as Permission[]).filter((p) => p === `${entity}.read`);

/** همه مجوزهای یک گروه (entity.*) */
const allOf = (entity: string): Permission[] =>
  (Object.values(PERMISSIONS) as Permission[]).filter((p) => p.startsWith(`${entity}.`));

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    name: "SUPER_ADMIN",
    title: "مدیر ارشد",
    permissions: [...(Object.values(PERMISSIONS) as Permission[])],
    isSystem: true,
  },
  {
    name: "STORE_MANAGER",
    title: "مدیر فروشگاه",
    permissions: [
      PERMISSIONS.profileSelf, // INFRA-08/2 — self-service تغییر رمز خود
      ...allOf("products"),
      PERMISSIONS.inventoryRead,
      PERMISSIONS.inventoryUpdate,
      PERMISSIONS.ordersRead,
      PERMISSIONS.ordersUpdate,
      PERMISSIONS.ordersRefund,
      PERMISSIONS.customersRead,
      PERMISSIONS.customersUpdate,
      ...allOf("coupons"),
      PERMISSIONS.reviewsRead,
      PERMISSIONS.reviewsModerate,
      PERMISSIONS.contentRead,
      ...allOf("media"),
      PERMISSIONS.analyticsRead,
      PERMISSIONS.settingsRead,
    ],
    isSystem: true,
  },
  {
    name: "ORDER_MANAGER",
    title: "مدیر سفارش‌ها",
    permissions: [
      PERMISSIONS.profileSelf, // INFRA-08/2 — self-service تغییر رمز خود
      ...readOf("products"),
      PERMISSIONS.ordersRead,
      PERMISSIONS.ordersUpdate,
      PERMISSIONS.ordersRefund,
      PERMISSIONS.customersRead,
      PERMISSIONS.analyticsRead,
    ],
    isSystem: true,
  },
  {
    name: "CONTENT_MANAGER",
    title: "مدیر محتوا",
    permissions: [
      PERMISSIONS.profileSelf, // INFRA-08/2 — self-service تغییر رمز خود
      PERMISSIONS.productsRead,
      PERMISSIONS.contentRead,
      PERMISSIONS.contentUpdate,
      PERMISSIONS.reviewsRead,
      PERMISSIONS.reviewsModerate,
      ...allOf("media"),
      PERMISSIONS.analyticsRead,
    ],
    isSystem: true,
  },
  {
    name: "SUPPORT_AGENT",
    title: "کارشناس پشتیبانی",
    permissions: [
      PERMISSIONS.profileSelf, // INFRA-08/2 — self-service تغییر رمز خود
      PERMISSIONS.productsRead,
      PERMISSIONS.ordersRead,
      PERMISSIONS.customersRead,
      PERMISSIONS.customersUpdate,
      PERMISSIONS.reviewsRead,
    ],
    isSystem: true,
  },
  {
    name: "MARKETING_MANAGER",
    title: "مدیر بازاریابی",
    permissions: [
      PERMISSIONS.profileSelf, // INFRA-08/2 — self-service تغییر رمز خود
      PERMISSIONS.productsRead,
      ...allOf("coupons"),
      PERMISSIONS.reviewsRead,
      PERMISSIONS.contentRead,
      PERMISSIONS.analyticsRead,
    ],
    isSystem: true,
  },
] as const;

export function getRoleDefinition(name: SystemRoleName): RoleDefinition {
  const role = ROLE_DEFINITIONS.find((r) => r.name === name);
  if (!role) throw new Error(`نقش سیستمی ناشناخته: ${name}`);
  return role;
}

/** چک سبک برای UI (نمایش/مخفی‌سازی دکمه) — امنیت واقعی همیشه در requirePermission است */
export function roleHas(role: SystemRoleName | null, permission: Permission): boolean {
  if (!role) return false;
  return getRoleDefinition(role).permissions.includes(permission);
}
