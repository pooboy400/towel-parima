/**
 * ZarinpalPaymentProvider — اداپتور درگاه زرین‌پال (PG v4 REST) — M5
 * ---------------------------------------------------------------
 * حالت‌ها (بخش ۱۲ و ۱۹ سند):
 *  - sandbox: sandbox.zarinpal.com — پول خیالی، ثبت‌نام ساده (M5 دمو)
 *  - live:    payment.zarinpal.com — درگاه واقعی؛ فقط با پذیرندگی تأییدشده
 *
 * تبدیل واحد فقط اینجاست: سیستم داخلی IRT (تومان) است؛ زرین‌پال ریال
 * می‌خواهد → ×10 داخل همین Adapter (قانون طلایی §12 — هیچ‌جای دیگر ×10 نمی‌شود).
 *
 * بدون ZARINPAL_MERCHANT_ID این اداپتور اصلاً فعال نمی‌شود (index.ts انتخاب
 * می‌کند) — یعنی سایت هرگز گیر نمی‌کند و به‌صورت خودکار روی درگاه داخلی mock برمی‌گردد.
 */

import { DomainError } from "@/core/errors";
import type {
  PaymentProvider,
  ParsedCallback,
  RefundPaymentResult,
  StartPaymentInput,
  StartPaymentResult,
  VerifyPaymentResult,
} from "./index";

const MERCHANT_LEN = 36;

/** کدهای شناخته‌شده زرین‌پال — فقط برای پیام فارسی قابل‌فهم (بخش ۶ سند: خطا به زبان کاربر) */
const ZP_ERROR_FA: Record<string, string> = {
  "-9": "اطلاعات ارسالی به درگاه معتبر نیست (merchant_id یا مبلغ).",
  "-10": "مرچنت آی‌دی معتبر نیست.",
  "-11": "مرچنت آی‌دی فعال نیست — درگاه را در پنل زرین‌پال فعال کنید.",
  "-50": "مبلغ پرداخت‌شده با مبلغ سفارش متفاوت است.",
  "-51": "پرداخت انجام نشده یا ناموفق بوده است.",
  "-52": "خطای غیرمنتظره درگاه — با پشتیبانی زرین‌پال تماس بگیرید.",
  "-53": "این پرداخت امکان برگشت وجه ندارد.",
  "-54": "authority معتبر نیست.",
  "-55": "تراکنش قبلاً استرداد شده است.",
  "101": "این تراکنش قبلاً تأیید شده است.",
};

function zarinpalFaMessage(code: string, fallback: string): string {
  return ZP_ERROR_FA[code] ?? `خطای درگاه زرین‌پال (کد ${code}).`;
}

interface ZpEnvelope<T> {
  data?: T | null;
  errors?: Record<string, unknown> | Array<Record<string, unknown>> | null;
}

export class ZarinpalPaymentProvider implements PaymentProvider {
  readonly name = "zarinpal";
  readonly sandbox: boolean;
  private readonly merchantId: string;
  private readonly baseUrl: string;

  constructor(opts?: { merchantId?: string; sandbox?: boolean }) {
    this.merchantId = opts?.merchantId ?? process.env.ZARINPAL_MERCHANT_ID ?? "";
    this.sandbox = opts?.sandbox ?? (process.env.ZARINPAL_SANDBOX ?? "true") !== "false";
    this.baseUrl = this.sandbox
      ? "https://sandbox.zarinpal.com"
      : "https://payment.zarinpal.com";

    if (this.merchantId.length !== MERCHANT_LEN) {
      // activation گارد — ولی ساخت instance نمی‌شکند؛ اولین startPayment خطای واضح می‌دهد
      console.error(
        JSON.stringify({
          level: "error",
          provider: "zarinpal",
          msg: "ZARINPAL_MERCHANT_ID تنظیم نشده یا فرمت آن (UUID ۳۶ نویسه‌ای) درست نیست.",
        }),
      );
    }
  }

  /** آدرس مطلق callback — زرین‌پال URL کامل می‌خواهد */
  private absoluteCallbackUrl(callbackUrl: string): string {
    if (callbackUrl.startsWith("http")) return callbackUrl;
    const site =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (this.sandbox ? "http://localhost:3000" : "http://localhost:3000");
    return `${site.replace(/\/$/, "")}${callbackUrl}`;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ merchant_id: this.merchantId, ...body }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch {
      throw new DomainError(
        "PAYMENT_GATEWAY_UNREACHABLE",
        "ارتباط با درگاه پرداخت برقرار نشد — لطفاً چند لحظه بعد دوباره تلاش کنید.",
      );
    }
    const json = (await res.json().catch(() => null)) as ZpEnvelope<T> | null;
    if (!json) {
      throw new DomainError(
        "PAYMENT_GATEWAY_INVALID_RESPONSE",
        "پاسخ نامعتبر از درگاه پرداخت — لطفاً دوباره تلاش کنید.",
      );
    }
    // خطای ساختاریافته؟
    const errs = json.errors;
    if (errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs).length > 0)) {
      const first = Array.isArray(errs) ? errs[0] : errs;
      const code = String((first as Record<string, unknown>)?.code ?? "unknown");
      throw new DomainError("PAYMENT_GATEWAY_ERROR", zarinpalFaMessage(code, "خطای درگاه."));
    }
    return json.data as T;
  }

  async startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
    if (this.merchantId.length !== MERCHANT_LEN) {
      throw new DomainError(
        "PAYMENT_CONFIG",
        "درگاه زرین‌پال تنظیم نشده است — با پشتیبانی فروشگاه تماس بگیرید.",
      );
    }
    // IRT → Rial (فقط همین‌جا ×10 — §12)
    const amountRial = input.amountIrt * 10;
    const data = await this.post<{ authority: string; code: number }>("/pg/v4/payment/request.json", {
      amount: amountRial,
      description: input.description ?? `پرداخت سفارش ${input.orderCode}`,
      callback_url: this.absoluteCallbackUrl(input.callbackUrl),
      metadata: input.phone ? { mobile: input.phone } : undefined,
    });

    const authority = data?.authority;
    if (!authority || data?.code !== 100) {
      throw new DomainError(
        "PAYMENT_START_FAILED",
        "شروع پرداخت در درگاه ناموفق بود — لطفاً دوباره تلاش کنید.",
      );
    }
    return {
      redirectUrl: `${this.baseUrl}/pg/StartPay/${encodeURIComponent(authority)}`,
      authority,
    };
  }

  async verifyPayment(input: {
    authority: string;
    amountIrt: number;
  }): Promise<VerifyPaymentResult> {
    const amountRial = input.amountIrt * 10;
    let data: { code?: number; ref_id?: number; card_pan?: string; amount?: number } | undefined;
    let codeStr = "unknown";

    try {
      data = await this.post<{ code?: number; ref_id?: number; card_pan?: string; amount?: number }>(
        "/pg/v4/payment/verify.json",
        { amount: amountRial, authority: input.authority },
      );
      codeStr = String(data?.code ?? "unknown");
    } catch (err) {
      // خطای ساختاریافتهٔ درگاه — پیام فارسی با کد؛ به‌عنوان verify ناموفق (نه استثنا) برمی‌گردد
      if (err instanceof DomainError) {
        return { ok: false, code: "gateway-error", message: err.message };
      }
      throw err;
    }

    // 100 = موفق · 101 = قبلاً تأییدشده (callback تکراری — بدون اثر مضاعف §11)
    if (data?.code === 100 || data?.code === 101) {
      // SEC-12 (فاز ۳) — مبلغ از پاسخ واقعی درگاه خوانده می‌شود (نه echo ورودی)؛
      // تطبیق مبلغ در payment-service حالا واقعاً معنا دارد. زرین‌پال ریال برمی‌گرداند.
      const verifiedAmountIrt =
        typeof data.amount === "number" ? Math.round(data.amount / 10) : input.amountIrt;
      return {
        ok: true,
        code: String(data.code),
        message: data.code === 101 ? "قبلاً تأیید شده" : "تأیید شد",
        transactionId: data.ref_id ? String(data.ref_id) : null,
        amount: verifiedAmountIrt,
        raw: { authority: input.authority, card_pan: data.card_pan ?? null },
      };
    }
    return { ok: false, code: codeStr, message: zarinpalFaMessage(codeStr, "تأیید ناموفق بود.") };
  }

  async refundPayment(input: {
    transactionId: string;
    amountIrt: number;
    authority?: string | null;
  }): Promise<RefundPaymentResult> {
    // INFRA-04 (فاز ۶) — گارد قفل: بازگشت وجه خودکار زرین‌پال تا زمان تأیید
    // sandbox رسمی خاموش است؛ مسیر fallback = پیگیری دستی ادمین (Refund FAILED).
    // فعال‌سازی صریح با ZARINPAL_REFUND_ENABLED=1 (پس از تست sandbox) یا دموی mock.
    if (
      process.env.ZARINPAL_REFUND_ENABLED !== "1" &&
      process.env.ALLOW_MOCKS_IN_PRODUCTION !== "1" &&
      process.env.NODE_ENV === "production"
    ) {
      return {
        ok: false,
        message: "بازگشت وجه خودکار زرین‌پال فعال نیست — پیگیری دستی توسط ادمین انجام می‌شود.",
      };
    }
    try {
      const data = await this.post<{ code?: number; message?: string }>(
        "/pg/v4/payment/refund.json",
        {
          // INFRA-04 — API refund زرین‌پال با authority کار می‌کند؛
          // transactionId (ref_id) فقط به‌عنوان fallback نسخه‌های قدیمی
          authority: input.authority ?? input.transactionId,
          amount: input.amountIrt * 10,
        },
      );
      if (data?.code === 100 || data?.code === 101) {
        return { ok: true, providerRef: data.code === 101 ? "already-refunded" : `zp-${Date.now()}` };
      }
      return {
        ok: false,
        message: zarinpalFaMessage(String(data?.code ?? "unknown"), "برگشت وجه ناموفق بود."),
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof DomainError ? err.message : "برگشت وجه در درگاه ناموفق بود.",
      };
    }
  }

  parseCallback(input: { searchParams: URLSearchParams }): ParsedCallback {
    const authority = input.searchParams.get("Authority") ?? input.searchParams.get("authority");
    const status = input.searchParams.get("Status") ?? input.searchParams.get("status");
    // زرین‌پال: Status=OK یعنی کاربر پرداخت را انجام داده (نیاز به verify سروری دارد)
    return { authority, ok: authority !== null && (status ?? "OK").toUpperCase() === "OK" };
  }

  buildResumeUrl(authority: string): string {
    return `${this.baseUrl}/pg/StartPay/${encodeURIComponent(authority)}`;
  }
}
