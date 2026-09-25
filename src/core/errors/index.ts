/**
 * DomainError — استاندارد خطای دامنه (بخش ۲۴ سند معماری)
 * ---------------------------------------------------------------
 * هر خطای دامنه با کد ثابت و پیام فارسی کاربرپسند ساخته می‌شود؛
 * Server Action / API Route آن را به پاسخ استاندارد تبدیل می‌کند و
 * stack trace هرگز به کلاینت نمی‌رسد.
 */

/** فهرست بسته کدهای خطا — کد جدید فقط با گسترش این union */
export type ErrorCode =
  | "VALIDATION_ERROR" // 400
  | "UNAUTHENTICATED" // 401
  | "FORBIDDEN" // 403
  | "NOT_FOUND" // 404
  | "OUT_OF_STOCK" // 409
  | "INVALID_TRANSITION" // 409
  | "CONFLICT" // 409
  | "COUPON_INVALID" // 422
  | "PAYMENT_VERIFY_FAILED" // 402/409
  | "PAYMENT_START_FAILED" // 502 — شروع پرداخت در درگاه رد شد
  | "PAYMENT_GATEWAY_UNREACHABLE" // 503 — شبکه/درگاه پاسخ نمی‌دهد
  | "PAYMENT_GATEWAY_INVALID_RESPONSE" // 502 — پاسخ خراب
  | "PAYMENT_GATEWAY_ERROR" // 502 — خطای ساختاریافتهٔ درگاه
  | "PAYMENT_CONFIG" // 500 — تنظیم ناقص درگاه (merchant_id …)
  | "RATE_LIMITED" // 429
  | "INTERNAL"; // 500

/** نگاشت پیش‌فرض کد → HTTP status (بخش ۲۴ سند) */
export const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  INVALID_TRANSITION: 409,
  CONFLICT: 409,
  COUPON_INVALID: 422,
  PAYMENT_VERIFY_FAILED: 402,
  PAYMENT_START_FAILED: 502,
  PAYMENT_GATEWAY_UNREACHABLE: 503,
  PAYMENT_GATEWAY_INVALID_RESPONSE: 502,
  PAYMENT_GATEWAY_ERROR: 502,
  PAYMENT_CONFIG: 500,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class DomainError extends Error {
  readonly code: ErrorCode;
  /** HTTP status — پیش‌فرض از جدول؛ موارد خاص (مثل 409 برای verify) می‌توانند override کنند */
  readonly status: number;
  /** شناسه درخواست برای ردیابی در لاگ سرور */
  readonly requestId?: string;
  /** اطلاعاتی مثل Retry-After برای RATE_LIMITED */
  readonly meta?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusOverride?: number,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = statusOverride ?? ERROR_STATUS[code];
    this.meta = meta;
  }
}

/** آیا خطای داده‌شده از جنس دامنه است؟ (برای تفکیک خطای برنامه‌نویسی) */
export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

/* ------------------------------------------------------------------ */
/* پاسخ استاندارد — شکل واحد برای همه Actionها و API Routes             */
/* ------------------------------------------------------------------ */

export interface StandardErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
    /** فقط فیلدهای امن — مثلاً Retry-After */
    meta?: Record<string, unknown>;
  };
}

export interface StandardSuccessBody<T> {
  data: T;
}

export type StandardBody<T> = StandardSuccessBody<T> | StandardErrorBody;

/** ساخت بدنه خطا از DomainError — بدون stack و بدون پیام داخلی */
export function toErrorBody(e: DomainError): StandardErrorBody {
  return {
    error: {
      code: e.code,
      message: e.message,
      ...(e.requestId ? { requestId: e.requestId } : {}),
      ...(e.meta ? { meta: e.meta } : {}),
    },
  };
}

/**
 * تبدیل خطای ناشناخته به INTERNAL امن — پیام اصلی فقط در لاگ سرور می‌ماند.
 * در M0 لاگ = console (JSON یک‌خطی)؛ در M6 به error tracking وصل می‌شود.
 *
 * خطاهای دامنه (DomainError) عمدی و امن‌اند: با همان کد/وضعیت/پیام فارسی
 * عبور می‌کنند — UNAUTHENTICATED باید 401 بماند نه اینکه با 500 بلعیده شود
 * (رفع یافتهٔ MEDIUM گزارش‌های 47-b/47-c). رفتار موردانتظار با «warn» لاگ
 * می‌شود، نه «error» (درس Task 43: خطای موردانتظار کاربر غیرفنی را نمی‌ترساند).
 */
export function toInternalError(e: unknown, requestId: string): DomainError {
  if (isDomainError(e)) {
    if (!e.requestId) {
      console.warn(
        JSON.stringify({
          level: "warn",
          type: "domain_error",
          requestId,
          code: e.code,
          message: e.message,
          ts: new Date().toISOString(),
        }),
      );
      return new DomainError(e.code, e.message, e.status, { ...e.meta, requestId });
    }
    return e;
  }
  const err = e instanceof Error ? e : new Error(String(e));
  console.error(
    JSON.stringify({
      level: "error",
      type: "internal_error",
      requestId,
      message: err.message,
      stack: err.stack,
      ts: new Date().toISOString(),
    }),
  );
  return new DomainError("INTERNAL", "خطای غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.", undefined, {
    requestId,
  });
}

/** تولید requestId سبک — کافی برای ردیابی؛ بدون وابستگی خارجی */
export function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
