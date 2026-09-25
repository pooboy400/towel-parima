/**
 * Domain Models — حساب کاربری، نقش‌ها، احراز هویت (ERD بخش ۴.۱ سند)
 * ---------------------------------------------------------------
 * ⚠️ امنیت: کد OTP خام هرگز در هیچ تایپی وجود ندارد — فقط codeHash.
 * Session دیتابیسی است (ADR-005) تا revocation واقعی و idle-timeout ممکن باشد.
 */

import type { ShippingAddressSnapshot } from "./commerce";

/* ------------------------------------------------------------------ */
/* Role + Permission — مدل RBAC (بخش ۶ سند)                             */
/* پیاده‌سازی ثابت‌ها و ماتریس در src/core/auth/permissions.ts          */
/* ------------------------------------------------------------------ */

export interface Role {
  id: string;
  /** `SUPER_ADMIN` · `STORE_MANAGER` · … — UNIQUE */
  name: string;
  /** نام فارسی برای نمایش در پنل */
  title: string;
  /** آرایه مجوزها — افزودن نقش/مجوز = رکورد جدید، بدون تغییر schema (ADR-002) */
  permissions: string[];
  /** نقش‌های سیستمی قابل حذف نیستند */
  isSystem: boolean;
}

/** شناسه‌های نقش سیستمی — مقادیر ستون Role.name */
export type SystemRoleName =
  | "SUPER_ADMIN"
  | "STORE_MANAGER"
  | "ORDER_MANAGER"
  | "CONTENT_MANAGER"
  | "SUPPORT_AGENT"
  | "MARKETING_MANAGER";

/* ------------------------------------------------------------------ */
/* User                                                                 */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  /** شناسه اصلی ورود — UNIQUE، فرمت 09xxxxxxxxx */
  phone: string;
  /** ورود OTP-محور است؛ رمز اختیاری (حداقل ۱۰ کاراکتر، هش argon2/bcrypt-12) */
  passwordHash?: string | null;
  name?: string | null;
  email?: string | null;
  /** NULL = customer عادی — به پنل ادمین هیچ دسترسی ندارد */
  roleId?: string | null;
  /** غیرفعال = منع ورود */
  isActive: boolean;
  lastLoginAt?: string | null;
  /** soft-delete — حساب حذف‌شده سفارش‌هایش را نگه می‌دارد (بخش ۱۴ سند) */
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Session — کوکی httpOnly + رکورد دیتابسی قابل revoke                  */
/* ------------------------------------------------------------------ */

export interface Session {
  id: string;
  /** توکن تصادفی امن — UNIQUE + INDEX؛ فقط hash آن در کوکی */
  sessionToken: string;
  userId: string;
  /** سیاست انقضای جدا برای ادمین (بخش ۹.۳ سند) */
  isAdminSession: boolean;
  /** برای audit ورود */
  ip?: string | null;
  userAgent?: string | null;
  /** آخرین فعالیت — مبنای idle-timeout ۳۰ دقیقه‌ای ادمین */
  idleAt?: string | null;
  /** انقضای مطلق — مشتری ۳۰ روز sliding · ادمین ۸ ساعت */
  expiresAt: string;
  /** revoke صریح: خروج، تغییر نقش، غیرفعال‌سازی */
  revokedAt?: string | null;
  createdAt: string;
}

/** هویت سبک داخل درخواست — خروجی authenticate در Guard Layer */
export interface AuthenticatedActor {
  userId: string;
  phone: string;
  name?: string | null;
  /** null = customer */
  role: SystemRoleName | null;
  permissions: readonly string[];
  sessionId: string;
  isAdminSession: boolean;
}

/* ------------------------------------------------------------------ */
/* OtpCode — hash-only، مصرف یک‌بار، سقف تلاش (بخش ۹.۴ سند)             */
/* ------------------------------------------------------------------ */

export interface OtpCode {
  id: string;
  phone: string;
  /** SHA-256(code + salt سرور) — کد خام هرگز ذخیره/منتقل نمی‌شود */
  codeHash: string;
  /** ۵ دقیقه پس از ارسال */
  expiresAt: string;
  /** حداکثر ۵ تلاش بررسی */
  attemptCount: number;
  /** مصرف یک‌بار — set شدن آن یعنی کد غیرقابل استفاده است */
  usedAt?: string | null;
  ip?: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Address / Wishlist                                                   */
/* ------------------------------------------------------------------ */

export interface Address {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  /** ۱۰ رقم، بدون خط تیره */
  postalCode: string;
  /** آدرس خطی کامل */
  line: string;
  isDefault: boolean;
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
}

/** تبدیل Address زنده به snapshot سفارش — در CheckoutService استفاده می‌شود */
export function toShippingSnapshot(a: Address, note?: string): ShippingAddressSnapshot {
  return {
    fullName: a.fullName,
    phone: a.phone,
    province: a.province,
    city: a.city,
    postalCode: a.postalCode,
    line: a.line,
    ...(note !== undefined ? { note } : {}),
  };
}
