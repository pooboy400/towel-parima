/**
 * نقشهٔ read صفحات ادمین — SEC-01 (authorize سطح صفحه)
 * ---------------------------------------------------------------
 * هر مسیر پنل فقط با مجوز read همان حوزه دیده می‌شود (مکمل ماتریس §۶ سند که
 * تا پیش از این فقط روی mutationها اعمال می‌شد).
 *
 * این فایل «منبع حقیقت» نقشه است و عمداً هیچ وابستگی سروری ندارد تا در تست‌ها
 * هم import شود:
 *   - `page-guard.ts`        → اجرای redirect روی سرور (بالا هر page)
 *   - `tests/integration/rbac-matrix.test.ts` → تست read-matrix
 *
 * افزودن صفحهٔ جدید پنل = یک ردیف در این نقشه + یک خط `requirePageAccess` در صفحه.
 * مجوزها «کافی است یکی برقرار باشد» (requireAnyPermission semantics).
 *
 * استثناهای عمدی بیرون نقشه:
 * - `/admin/login` و `/admin/no-access` — فقط احراز هویت (گارد صفحه بی‌معناست)
 * - `/admin/account` — فقط احراز هویت؛ محتوا رکورد خودِ کاربر لاگین است
 *   (CR-8/55-c: تصمیم مستند — مجوز read بی‌معنا چون دادهٔ دیگری ندارد)
 */

import { PERMISSIONS } from "@/core/auth/permissions";

export const ADMIN_PAGE_READ_MAP = {
  /** داشبورد — KPI فروش/ارزش انبار/پرفروش (تجمیع درآمد؛ CR-1/55-c) */
  dashboard: [PERMISSIONS.analyticsRead],
  /** کارکنان و نقش‌ها — داده حساس (ایمیل/موبایل همه کاربران) */
  staff: [PERMISSIONS.usersRead],
  /** دفتر رویدادها — شامل IP و User-Agent */
  audit: [PERMISSIONS.auditRead],
  /** تنظیمات فروشگاه */
  settings: [PERMISSIONS.settingsRead],
  /** سفارش‌ها — شامل آدرس و موبایل مشتری */
  orders: [PERMISSIONS.ordersRead],
  /** پیام‌های خصوصی مشتری‌ها + خبرنامه — حوزهٔ customers (پشتیبانی مجاز است) */
  messages: [PERMISSIONS.customersRead],
  /** کاتالوگ محصول */
  products: [PERMISSIONS.productsRead],
  /** نظرات مشتریان */
  reviews: [PERMISSIONS.reviewsRead],
  /** ژورنال/مقالات */
  journal: [PERMISSIONS.contentRead],
  /** کتابخانه رسانه */
  media: [PERMISSIONS.mediaRead],
  /** سوالات متداول — محتوا */
  faq: [PERMISSIONS.contentRead],
  /** دسته‌بندی‌ها — کاتالوگ (mutationهای همین صفحه productsUpdate/Delete هستند) */
  categories: [PERMISSIONS.productsRead],
  /** کالکشن‌ها — کاتالوگ */
  collections: [PERMISSIONS.productsRead],
  /** لاگ پیامک‌ها — حوزهٔ اطلاع‌رسانی سفارش (CR-8/55-c: گارد قبلی به /admin ریدایرکت می‌کرد) */
  sms: [PERMISSIONS.ordersRead],
  /** مرکز اعلان‌ها — فید زنگ اعلان (همان ترکیب requireAnyPermission قبلی) */
  notifications: [PERMISSIONS.analyticsRead, PERMISSIONS.productsRead, PERMISSIONS.reviewsRead],
} as const;

export type AdminPageRoute = keyof typeof ADMIN_PAGE_READ_MAP;

/** چک خالص (بدون I/O) — آیا این فهرست مجوز، این صفحه را می‌بیند؟ (برای UI و تست) */
export function canAccessAdminPage(
  permissions: readonly string[],
  route: AdminPageRoute,
): boolean {
  return ADMIN_PAGE_READ_MAP[route].some((p) => permissions.includes(p));
}
