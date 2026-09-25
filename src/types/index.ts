/**
 * Domain Types — نقطه سازگاری فاز ۱
 * ---------------------------------------------------------------
 * از M0 قراردادهای دامنه در src/domain/models زندگی می‌کنند (بخش ۲۶ سند معماری)
 * و این فایل فقط re-export می‌کند تا importهای فاز ۱ (`@/types`) بدون تغییر کار کنند.
 *
 * در پایان M1 این فایل حذف و همه importها به `@/domain/models` مهاجرت می‌کنند.
 * ⚠️ هیچ تایپ جدیدی اینجا تعریف نمی‌شود.
 */

export type {
  ProductStatus,
  BadgeType,
  Category,
  Collection,
  ColorOption,
  ProductSize,
  ProductSpec,
  Product,
  Review,
  JournalPost,
  FaqItem,
  Testimonial,
  Variant,
} from "@/domain/models/catalog";

export { assertVariantInvariants } from "@/domain/models/catalog";

export type {
  CartLine,
  ShippingMethod,
  AddressFormValues,
  OrderSummaryTotals,
  SortOption,
  ProductFilters,
  StoreConfig,
} from "@/domain/models/cart";

export type {
  Currency,
  OrderStatus,
  PaymentStatus,
  ShipmentStatus,
  ReservationStatus,
  RefundStatus,
  CouponType,
  ShippingAddressSnapshot,
  Order,
  OrderItem,
  InventoryReservation,
  Payment,
  Refund,
  Shipment,
  Coupon,
  CouponRedemption,
} from "@/domain/models/commerce";

export { CANONICAL_CURRENCY } from "@/domain/models/commerce";

export type {
  Role,
  SystemRoleName,
  User,
  Session,
  AuthenticatedActor,
  OtpCode,
  Address,
  WishlistItem,
} from "@/domain/models/account";

export { toShippingSnapshot } from "@/domain/models/account";

export type {
  ReviewStatus,
  ContentStatus,
  ManagedReview,
  AuditLogEntry,
  MandatoryAuditAction,
  OutboxStatus,
  OutboxEventType,
  OutboxEvent,
  MediaObject,
  SettingRecord,
  ManagedJournalPost,
  ManagedFaqItem,
  ReviewSource,
} from "@/domain/models/system";

export { MANDATORY_AUDIT_ACTIONS } from "@/domain/models/system";

export type { StoreSettings } from "@/domain/models/settings";

export { STORE_SETTINGS_KEY } from "@/domain/models/settings";
