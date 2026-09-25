/**
 * Provider Abstraction — قراردادهای وابستگی‌های خارجی (بخش ۱۹ سند معماری)
 * ---------------------------------------------------------------
 * M0: فقط types — هیچ پیاده‌سازیای اینجا نیست (طبق چک‌لیست M0 سند).
 * M2: Storage (Local/S3) · M5: Payment (زرین‌پال/Mock) و SMS/Email.
 *
 * قوانین:
 * - تعویض سرویس‌دهنده = adapter جدید؛ Business Logic هرگز لمس نمی‌شود.
 * - تبدیل واحد پول (IRT ↔ واحد درگاه) فقط داخل PaymentAdapter (ADR-004).
 * - انتخاب Provider با env — قابلیت تست با MockPaymentProvider.
 */

/* ------------------------------------------------------------------ */
/* Payment                                                              */
/* ------------------------------------------------------------------ */

export interface PaymentStartResult {
  /** URL ریدایرکت کاربر به درگاه */
  redirectUrl: string;
  /** شناسه سمت درگاه — در رکورد Payment با UNIQUE ذخیره می‌شود */
  authority: string;
}

export interface PaymentVerifyResult {
  ok: boolean;
  /** در صورت ok — پس از تأیید سروری */
  transactionId?: string;
  /** مبلغ تأییدشده سمت درگاه — باید با رکورد Payment مقایسه شود */
  amount: number;
  /** پاس خام برای metadata */
  raw: Record<string, unknown>;
}

export interface PaymentRefundResult {
  ok: boolean;
  providerRef?: string;
  reason?: string;
}

export interface ParsedPaymentCallback {
  authority: string;
  /** status سمت درگاه — verify سروری حرف آخر را می‌زند؛ این فقط مسیریابی است */
  status: "OK" | "NOK" | "UNKNOWN";
}

export interface PaymentProvider {
  readonly name: string;
  /**
   * شروع پرداخت — ⚠️ خارج از DB Transaction فراخوانی می‌شود (بخش ۱۰.۱ سند)؛
   * ثبت رکورد Payment پس از دریافت authority در tx کوچک جدا انجام می‌شود.
   */
  startPayment(order: {
    id: string;
    code: string;
    grandTotal: number;
    currency: "IRT";
    callbackUrl: string;
    description: string;
    phone?: string;
  }): Promise<PaymentStartResult>;

  /** verify سمت سرور — تنها منبع حقیقت موفقیت (هیچ اطلاع client مبنا نیست) */
  verifyPayment(authority: string): Promise<PaymentVerifyResult>;

  /** refund — در M5؛ با reconciliation */
  refundPayment(transactionId: string, amount: number): Promise<PaymentRefundResult>;

  /** استخراج authority/status از request درگاه (callback یا webhook) */
  parseCallback(req: Request): Promise<ParsedPaymentCallback>;
}

/* ------------------------------------------------------------------ */
/* SMS                                                                  */
/* ------------------------------------------------------------------ */

export interface SmsSendResult {
  ok: boolean;
  providerMessageId?: string;
  reason?: string;
}

export interface SmsProvider {
  readonly name: string;
  /**
   * ⚠️ هرگز داخل DB Transaction فراخوانی نمی‌شود — فقط از طریق Outbox Worker.
   * شماره ورودی نرمال‌شده (normalizePhone) است.
   */
  send(phone: string, message: string): Promise<SmsSendResult>;
}

/* ------------------------------------------------------------------ */
/* Email                                                                */
/* ------------------------------------------------------------------ */

export interface EmailProvider {
  readonly name: string;
  /** HTML ورودی باید sanitize-شده باشد (بخش ۲۱.۳ سند) */
  send(to: string, subject: string, html: string): Promise<{ ok: boolean; reason?: string }>;
}

/* ------------------------------------------------------------------ */
/* Storage (بخش ۲۱ سند)                                                 */
/* ------------------------------------------------------------------ */

export interface StoragePutResult {
  key: string;
  /** URL عمومی نهایی (CDN در production) */
  url: string;
}

export interface StorageProvider {
  readonly name: string;
  /**
   * ذخیره امن — key همیشه سرور ساخته می‌شود (UUIDv7)؛
   * filename کلاینت هرگز بخشی از key نمی‌شود.
   */
  put(key: string, buffer: Buffer, mime: string): Promise<StoragePutResult>;
  delete(key: string): Promise<void>;
  /** URL عمومی برای next/image */
  publicUrl(key: string): string;
}

/* ------------------------------------------------------------------ */
/* انتخاب Provider با env — قرارداد نام‌ها                              */
/* ------------------------------------------------------------------ */

export const PROVIDER_ENV_KEYS = {
  payment: "PAYMENT_PROVIDER",
  sms: "SMS_PROVIDER",
  email: "EMAIL_PROVIDER",
  storage: "STORAGE_PROVIDER",
} as const;

/** مقادیر مجاز فعلی — adapterها در مایلستون‌های مربوط اضافه می‌شوند */
export const SUPPORTED_PROVIDERS = {
  payment: ["mock", "zarinpal", "zibal"] as const,
  sms: ["console", "kavenegar"] as const,
  email: ["console", "smtp"] as const,
  storage: ["local", "s3"] as const,
} as const;
