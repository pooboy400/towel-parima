/**
 * RBAC — فهرست کانونی مجوزها (بخش ۶.۲ سند معماری)
 * ---------------------------------------------------------------
 * Permissionها رشته‌های کانونی با الگوی entity.action هستند.
 * افزودن مجوز جدید = یک ثابت جدید در این فایل + افزودن به نقش‌ها در roles.ts —
 * هیچ تغییر schema و هیچ تغییر معماری (ADR-002).
 */

export const PERMISSIONS = {
  productsRead: "products.read",
  productsCreate: "products.create",
  productsUpdate: "products.update",
  productsDelete: "products.delete",

  inventoryRead: "inventory.read",
  inventoryUpdate: "inventory.update",

  ordersRead: "orders.read",
  ordersUpdate: "orders.update",
  ordersRefund: "orders.refund",

  customersRead: "customers.read",
  customersUpdate: "customers.update",

  couponsRead: "coupons.read",
  couponsCreate: "coupons.create",
  couponsUpdate: "coupons.update",
  couponsDelete: "coupons.delete",

  reviewsRead: "reviews.read",
  reviewsModerate: "reviews.moderate",

  contentRead: "content.read",
  contentUpdate: "content.update",

  mediaRead: "media.read",
  mediaUpload: "media.upload",
  mediaDelete: "media.delete",

  analyticsRead: "analytics.read",

  settingsRead: "settings.read",
  settingsUpdate: "settings.update",

  usersRead: "users.read",
  usersUpdate: "users.update",

  auditRead: "audit.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** فهرست کانونی — مرجع تست‌ها و seed نقش‌ها؛ دقیقاً ۲۸ مجوز (بخش ۶.۲ سند) */
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);
