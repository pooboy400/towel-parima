/**
 * State Machines — گذارهای مجاز (بخش ۵ سند معماری)
 * ---------------------------------------------------------------
 * قوانین:
 * ۱. هیچ گذاری مستقیم از طریق UPDATE ادمین انجام نمی‌شود — فقط متدهای دامنه
 *    (OrderService.transition و …) که از assertTransition این ماژول عبور می‌کنند.
 * ۲. هر گذار شرط و مجری مشخص دارد (جدول بخش ۵ سند) — شرط‌های وابسته به داده
 *    (مثل «پرداخت PAID شد») در Service بررسی و اینجا فقط توپولوژی گذار تعریف می‌شود.
 * ۳. سه ماشین Order / Payment / Shipment مستقل‌اند؛ سازگاری‌شان در Service تضمین می‌شود.
 */

import type {
  OrderStatus,
  PaymentStatus,
  ShipmentStatus,
  ReservationStatus,
  RefundStatus,
} from "../models/commerce";
import type { ReviewStatus, ContentStatus } from "../models/system";
import { DomainError } from "../../core/errors";

/** کد خطای گذار غیرمجاز — استاندارد بخش ۲۴ سند */
export const INVALID_TRANSITION = "INVALID_TRANSITION";

/* ------------------------------------------------------------------ */
/* Order (بخش ۵.۱)                                                      */
/* ------------------------------------------------------------------ */

/**
 * نقش مجری گذار — برای لاگ و audit؛ authorization خودش در Guard Layer است.
 * - system: خودکار (تأیید پرداخت، تایم‌اوت)
 * - customer: درخواست مرجوعی / انصراف
 * - admin: پردازش، ارسال، تحویل، لغو
 */
export type TransitionActor = "system" | "customer" | "admin";

export interface OrderTransitionRule {
  from: OrderStatus;
  to: OrderStatus;
  actor: TransitionActor;
  /** شرط دامنه — متنی برای مستندسازی و تست */
  condition: string;
  /** permission لازم در صورت admin بودن مجری */
  adminPermission?: string;
}

export const ORDER_TRANSITIONS: readonly OrderTransitionRule[] = [
  {
    from: "PENDING",
    to: "PROCESSING",
    actor: "system",
    condition: "پرداخت PAID شد (خودکار در Payment confirm)",
  },
  {
    from: "PENDING",
    to: "CANCELLED",
    actor: "customer",
    condition: "انصراف کاربر / تایم‌اوت پنجره پرداخت — رزروها آزاد می‌شوند",
  },
  {
    from: "PENDING",
    to: "CANCELLED",
    actor: "admin",
    condition: "لغو ادمین — رزروها آزاد می‌شوند",
    adminPermission: "orders.update",
  },
  {
    from: "PROCESSING",
    to: "SHIPPED",
    actor: "admin",
    condition: "ثبت Shipment با کد رهگیری",
    adminPermission: "orders.update",
  },
  {
    from: "SHIPPED",
    to: "DELIVERED",
    actor: "admin",
    condition: "تأیید تحویل",
    adminPermission: "orders.update",
  },
  {
    from: "PROCESSING",
    to: "CANCELLED",
    actor: "admin",
    condition: "لغو پیش از ارسال + refund خودکار اگر PAID",
    adminPermission: "orders.update",
  },
  {
    from: "DELIVERED",
    to: "RETURN_REQUESTED",
    actor: "customer",
    condition: "درخواست مرجوعی داخل بازه سیاست (returnWindowDays)",
  },
  {
    from: "RETURN_REQUESTED",
    to: "RETURNED",
    actor: "admin",
    condition: "تأیید ادمین — برگرداندن موجودی + اجرای refund",
    adminPermission: "orders.update",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Payment (بخش ۵.۲) — هر رکورد = یک تلاش                               */
/* ------------------------------------------------------------------ */

export const PAYMENT_TRANSITIONS: readonly { from: PaymentStatus; to: PaymentStatus; condition: string }[] = [
  { from: "PENDING", to: "PAID", condition: "verify سروری موفق + چک مبلغ + idempotent" },
  { from: "PENDING", to: "FAILED", condition: "verify ناموفق / انقضای پنجره پرداخت / لغو کاربر" },
  { from: "PAID", to: "PARTIALLY_REFUNDED", condition: "refund جزئی موفق" },
  { from: "PARTIALLY_REFUNDED", to: "REFUNDED", condition: "باقی‌مانده مبلغ نیز برگشت خورد" },
  { from: "PAID", to: "REFUNDED", condition: "refund کامل در یک مرحله" },
] as const;

/* ------------------------------------------------------------------ */
/* Shipment (بخش ۵.۳)                                                   */
/* ------------------------------------------------------------------ */

export const SHIPMENT_TRANSITIONS: readonly { from: ShipmentStatus; to: ShipmentStatus; condition: string }[] = [
  { from: "PENDING", to: "READY", condition: "بسته‌بندی و آماده‌سازی" },
  { from: "READY", to: "SHIPPED", condition: "تحویل به پست/پیک با کد رهگیری" },
  { from: "SHIPPED", to: "IN_TRANSIT", condition: "در مسیر" },
  { from: "IN_TRANSIT", to: "DELIVERED", condition: "تحویل شد" },
  { from: "SHIPPED", to: "FAILED", condition: "عدم امکان تحویل" },
  { from: "IN_TRANSIT", to: "FAILED", condition: "عدم امکان تحویل" },
  { from: "FAILED", to: "RETURNED", condition: "مرجوع به انبار" },
] as const;

/* ------------------------------------------------------------------ */
/* Reservation (بخش ۵.۴)                                                */
/* ------------------------------------------------------------------ */

export const RESERVATION_TRANSITIONS: readonly { from: ReservationStatus; to: ReservationStatus; condition: string }[] = [
  { from: "ACTIVE", to: "CONVERTED", condition: "پرداخت موفق — stock−=qty و reserved−=qty در همان tx" },
  { from: "ACTIVE", to: "RELEASED", condition: "لغو سفارش / خطای پرداخت — فقط reserved−=qty" },
  { from: "ACTIVE", to: "EXPIRED", condition: "worker انقضا — TTL ۲۰ دقیقه" },
] as const;

/* ------------------------------------------------------------------ */
/* Refund · Review · Content (بخش ۵.۵)                                  */
/* ------------------------------------------------------------------ */

export const REFUND_TRANSITIONS: readonly { from: RefundStatus; to: RefundStatus; condition: string }[] = [
  { from: "REQUESTED", to: "PROCESSING", condition: "پذیرش ادمین" },
  { from: "PROCESSING", to: "SUCCEEDED", condition: "درگاه تأیید کرد (providerRef ثبت می‌شود)" },
  { from: "PROCESSING", to: "FAILED", condition: "درگاه رد کرد — قابل تلاش مجدد با رکورد جدید" },
] as const;

export const REVIEW_TRANSITIONS: readonly { from: ReviewStatus; to: ReviewStatus; condition: string }[] = [
  { from: "PENDING", to: "APPROVED", condition: "تأیید ادمین (reviews.moderate)" },
  { from: "PENDING", to: "REJECTED", condition: "رد ادمین (reviews.moderate)" },
] as const;

export const CONTENT_TRANSITIONS: readonly { from: ContentStatus; to: ContentStatus; condition: string }[] = [
  { from: "DRAFT", to: "PUBLISHED", condition: "انتشار — DRAFT هرگز عمومی نیست" },
  { from: "PUBLISHED", to: "ARCHIVED", condition: "بایگانی" },
] as const;

/* ------------------------------------------------------------------ */
/* موتور عمومی بررسی گذار                                               */
/* ------------------------------------------------------------------ */

export interface TransitionCheck {
  allowed: boolean;
  /** rule منطبق — برای audit و لاگ */
  rule?: unknown;
}

/** بررسی عمومی گذار روی یک جدول گذار — pure و تست‌پذیر */
export function checkTransition<TFrom extends string, TTo extends string>(
  table: readonly { from: TFrom; to: TTo; condition: string }[],
  from: TFrom,
  to: TTo,
): TransitionCheck {
  const rule = table.find((r) => r.from === from && r.to === to);
  return { allowed: Boolean(rule), rule };
}

/** بررسی گذار سفارش + نقش مجری — خطای DomainError استاندارد در صورت نقض */
export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: TransitionActor,
): OrderTransitionRule {
  const rule = ORDER_TRANSITIONS.find((r) => r.from === from && r.to === to);
  if (!rule) {
    throw new DomainError(
      INVALID_TRANSITION,
      `گذار وضعیت سفارش از ${from} به ${to} مجاز نیست`,
      409,
    );
  }
  if (rule.actor !== actor) {
    throw new DomainError(
      INVALID_TRANSITION,
      `گذار ${from} → ${to} توسط ${actor} مجاز نیست (مجری: ${rule.actor})`,
      403,
    );
  }
  return rule;
}
