/**
 * Domain Models — سیستم: Audit، Outbox، Media، Setting (ERD بخش ۴.۴ سند)
 * ---------------------------------------------------------------
 * ⚠️ AuditLog و OutboxEvent و رکوردهای مالی هرگز delete نمی‌شوند (بخش ۱۴ سند).
 */

import type { Review } from "./catalog";
import type { SystemRoleName } from "./account";

/* ------------------------------------------------------------------ */
/* وضعیت‌های محتوا                                                      */
/* ------------------------------------------------------------------ */

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** نظر دامنه v2 — جدول Review با وضعیت مدیریت؛ نمایش عمومی فقط APPROVED */
export interface ManagedReview {
  id: string;
  productId: string;
  userId?: string | null;
  /** نام نمایشی — اگر کاربر لاگین باشد از پروفایل */
  authorName: string;
  /** 1..5 */
  rating: number;
  body: string;
  status: ReviewStatus;
  publishedAt?: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Audit Log — append-only (بخش ۲۰ سند)                                 */
/* ------------------------------------------------------------------ */

/** ثبت هر mutation ادمین — هیچ update/delete روی این رکورد مجاز نیست */
export interface AuditLogEntry {
  id: string;
  /** null = اقدام سیستم */
  actorId?: string | null;
  /** `product.update` · `order.refund` · `auth.login.failed` · … */
  action: string;
  entityType: string;
  entityId: string;
  /** حالت قبل — برای تغییرها */
  before?: Record<string, unknown> | null;
  /** حالت بعد */
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

/** اکشن‌های حساس که audit آن‌ها اجباری است (بخش ۲۰ سند) */
export const MANDATORY_AUDIT_ACTIONS = [
  "product.price.update",
  "inventory.adjust",
  "order.refund",
  "user.role.update",
  "settings.update",
  "auth.login.success",
  "auth.login.failed",
] as const;

export type MandatoryAuditAction = (typeof MANDATORY_AUDIT_ACTIONS)[number];

/* ------------------------------------------------------------------ */
/* Outbox Event — بخش ۱۵ سند                                            */
/* ------------------------------------------------------------------ */

export type OutboxStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

/** فهرست بسته رویدادها (بخش ۱۵.۲ سند) — رویداد جدید فقط با گسترش این union */
export type OutboxEventType =
  | "OrderCreated"
  | "PaymentSucceeded"
  | "PaymentFailed"
  | "OrderShipped"
  | "OrderDelivered"
  | "OrderCancelled"
  | "ProductBackInStock"
  | "ReviewSubmitted"
  | "UserRegistered";

export interface OutboxEvent {
  id: string;
  type: OutboxEventType;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  lastError?: string | null;
  /** زمان آزادسازی بعدی — backoff نمایی ۱→۲→۴→۸ دقیقه */
  availableAt: string;
  processedAt?: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Media (بخش ۲۱ سند) — SVG ممنوع در v1                                 */
/* ------------------------------------------------------------------ */

export interface MediaObject {
  id: string;
  /** کلید در storage — random UUIDv7، ساختار uploads/{yyyy}/{mm}/{key}.{ext} */
  storageKey: string;
  mime: string;
  sizeBytes: number;
  width: number;
  height: number;
  /** dedup آپلود تکراری — UNIQUE */
  sha256: string;
  uploadedBy?: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Setting (بخش ۱۸ سند) — خواندن فقط از SettingsService تایپ‌شده         */
/* ------------------------------------------------------------------ */

export interface SettingRecord {
  key: string;
  value: Record<string, unknown>;
  updatedAt: string;
  updatedBy?: string | null;
}

/* ------------------------------------------------------------------ */
/* JournalPost v2 — با وضعیت مدیریت (بخش ۴.۴ سند)                        */
/* ------------------------------------------------------------------ */

export interface ManagedJournalPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Markdown خام — پیش از رندر حتماً sanitize (بخش ۲۱.۳ سند) */
  bodyMarkdown: string;
  coverKey?: string | null;
  topic: string;
  readingMinutes: number;
  status: ContentStatus;
  publishedAt?: string | null;
  authorId?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                  */
/* ------------------------------------------------------------------ */

export interface ManagedFaqItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

/** اتصال تایپ نظر فاز ۱ به وضعیت مدیریت — mapping در Repository انجام می‌شود */
export type ReviewSource = Review & { status?: ReviewStatus };

export type { SystemRoleName };
