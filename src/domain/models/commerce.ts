/**
 * Domain Models — فروش، سفارش، پرداخت (ERD بخش ۴.۳ سند معماری)
 * ---------------------------------------------------------------
 * ⚠️ قانون Immutability (بخش ۱۴ سند): سفارش/پرداخت/refund رکورد تاریخی‌اند؛
 * همه مقادیر متغیر دنیای واقعی به‌صورت SNAPSHOT ذخیره می‌شوند و پس از ثبت
 * فقط گذار وضعیتِ کنترل‌شده (state-machines) دارند.
 *
 * 💰 پول: همه مبالغ Integer به IRT (تومان) — هیچ Float در محاسبات مالی (بخش ۱۲ سند).
 */

/** واحد پول canonical کل سیستم — از روز اول در همه رکوردهای مالی snapshot می‌شود */
export type Currency = "IRT";
export const CANONICAL_CURRENCY: Currency = "IRT";

/* ------------------------------------------------------------------ */
/* Enumهای دامنه (بخش ۴.۰ سند)                                          */
/* ------------------------------------------------------------------ */

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED";

export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type ShipmentStatus =
  | "PENDING"
  | "READY"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED";

export type ReservationStatus = "ACTIVE" | "CONVERTED" | "RELEASED" | "EXPIRED";

export type RefundStatus = "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export type CouponType = "PERCENT" | "FIXED";

/* ------------------------------------------------------------------ */
/* Snapshot آدرس — سفارش هرگز به رکورد زنده Address وابسته نیست        */
/* ------------------------------------------------------------------ */

/** عکس لحظه‌ای آدرس در زمان ثبت سفارش (Json در دیتابیس) */
export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  /** آدرس خطی کامل */
  line: string;
  /** یادداشت سفارش در زمان ثبت */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Order — رکورد تاریخی immutable (به‌جز status/note)                   */
/* ------------------------------------------------------------------ */

export interface Order {
  id: string;
  /** کد رهگیری مشتری — UNIQUE، حداکثر ۱۰ کاراکتر */
  code: string;
  /** پس از حذف حساب کاربر، سفارش با SET NULL بی‌مالک ولی سالم می‌ماند */
  userId?: string | null;
  /** شماره تماس مستقل از حساب — برای هماهنگی ارسال */
  phone: string;
  status: OrderStatus;
  /** جمع اقلام = Σ(unitPrice × quantity) */
  subtotal: number;
  /** تخفیف کل (کوپن) */
  discountTotal: number;
  /** هزینه ارسال */
  shippingTotal: number;
  /** مالیات — فعلاً همیشه ۰ (فروشگاه B2C فاز اول) */
  taxTotal: number;
  /** مبلغ نهایی = subtotal − discountTotal + shippingTotal + taxTotal */
  grandTotal: number;
  currency: Currency;
  shippingAddress: ShippingAddressSnapshot;
  /** کد کوپن استفاده‌شده در زمان ثبت */
  couponCodeSnapshot?: string | null;
  /** یادداشت داخلی — تنها فیلد قابل ویرایش توسط ادمین به‌جز status */
  note?: string | null;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** یک قلم سفارش — snapshot کامل؛ هیچ FK زنده‌ای به کاتالوگ ندارد */
export interface OrderItem {
  id: string;
  orderId: string;
  /** شناسه‌ها فقط به‌عنوان رشته ذخیره می‌شوند (RESTRICT — بخش ۴.۵ سند) */
  productId: string;
  variantId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string;
  imageUrlSnapshot?: string | null;
  /** قیمت واحد در لحظه ثبت — IRT Integer */
  unitPrice: number;
  quantity: number;
  /** تخفیف اعمال‌شده روی همین قلم */
  discount: number;
  /** total = unitPrice × quantity − discount */
  total: number;
}

/* ------------------------------------------------------------------ */
/* InventoryReservation — TTL ۲۰ دقیقه (بخش ۱۳ سند)                     */
/* ------------------------------------------------------------------ */

export interface InventoryReservation {
  id: string;
  variantId: string;
  orderId?: string | null;
  /** تعداد رزروشده — ≥ ۱ */
  qty: number;
  status: ReservationStatus;
  /** انقضای پنجره پرداخت — پیش‌فرض ۲۰ دقیقه از createdAt */
  expiresAt: string;
  createdAt: string;
  releasedAt?: string | null;
}

/* ------------------------------------------------------------------ */
/* Payment — هر رکورد = یک تلاش پرداخت (PaymentAttempt)                 */
/* ------------------------------------------------------------------ */

export interface Payment {
  id: string;
  orderId: string;
  /** `zarinpal` · `zibal` · … — انتخاب با env در Adapter */
  provider: string;
  /** شناسه سمت درگاه — UNIQUE؛ کلید idempotency callback (بخش ۱۱ سند) */
  authority: string;
  /** پس از verify موفق ست می‌شود — UNIQUE */
  transactionId?: string | null;
  /** مبلغ درخواستی — IRT Integer */
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  /** پاس‌های خام درگاه — فقط برای اشکال‌زدایی؛ بدون داده حساس */
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  verifiedAt?: string | null;
}

/* ------------------------------------------------------------------ */
/* Refund                                                               */
/* ------------------------------------------------------------------ */

export interface Refund {
  id: string;
  paymentId: string;
  orderId: string;
  /** مبلغ بازگشتی — IRT Integer؛ ≤ مبلغ پرداخت‌شده */
  amount: number;
  reason: string;
  status: RefundStatus;
  /** شناسه refund سمت درگاه پس از موفقیت */
  providerRef?: string | null;
  /** ادمین اجراکننده — پس از حذف کاربر SET NULL */
  actorId?: string | null;
  createdAt: string;
  succeededAt?: string | null;
}

/* ------------------------------------------------------------------ */
/* Shipment                                                             */
/* ------------------------------------------------------------------ */

export interface Shipment {
  id: string;
  orderId: string;
  /** پست / تیپاکس / پیک … */
  carrier?: string | null;
  trackingCode?: string | null;
  status: ShipmentStatus;
  addressSnapshot: ShippingAddressSnapshot;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Coupon + مصرف تراکنشی (بخش ۱۰ سند)                                   */
/* ------------------------------------------------------------------ */

export interface Coupon {
  id: string;
  /** کد یکتا — در ورودی نرمال‌سازی می‌شود (trim + حروف بزرگ لاتین) */
  code: string;
  type: CouponType;
  /** PERCENT: 1..100 · FIXED: مبلغ IRT */
  value: number;
  /** حداقل مبلغ سبد برای اعتبار */
  minSubtotal?: number | null;
  /** سقف تخفیف برای PERCENT */
  maxDiscount?: number | null;
  /** سقف کلی استفاده */
  usageLimit?: number | null;
  /** سقف استفاده هر کاربر */
  perUserLimit?: number | null;
  /** شمارنده کش‌شده — حقیقت از CouponRedemption خوانده می‌شود */
  usedCount: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  deletedAt?: string | null;
}

/** ثبت مصرف کوپن — UNIQUE(couponId, orderId)؛ خط دفاعی نهایی تکرار */
export interface CouponRedemption {
  id: string;
  couponId: string;
  orderId: string;
  userId?: string | null;
  createdAt: string;
}
