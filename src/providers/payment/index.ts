/**
 * PaymentProvider — abstraction درگاه پرداخت (بخش ۱۹ سند)
 * ---------------------------------------------------------------
 * تبدیل واحد پول (IRT↔واحد درگاه) فقط داخل Adapter انجام می‌شود.
 * انتخاب Provider با env: PAYMENT_PROVIDER=mock|zarinpal|zibal
 * M3: فقط Mock — زرین‌پال واقعی در M5.
 */

export interface StartPaymentInput {
  /** کد سفارش — برای توضیح/سایت درگاه */
  orderCode: string;
  /** مبلغ IRT صحیح */
  amountIrt: number;
  /** آدرس برگشت به سایت (callback) */
  callbackUrl: string;
  /** موبایل خریدار — برای prefill درگاه (اختیاری) */
  phone?: string | null;
  description?: string;
}

export interface StartPaymentResult {
  /** URL هدایت کاربر به درگاه */
  redirectUrl: string;
  /** شناسه سمت درگاه — UNIQUE روی رکورد Payment */
  authority: string;
}

export interface VerifyPaymentResult {
  ok: boolean;
  /** کد پیام درگاه برای لاگ/دیباگ */
  code?: string;
  message?: string;
  transactionId?: string | null;
  /** مبلغ برگشتی از درگاه — باید با رکورد Payment تطبیق داده شود */
  amount?: number;
  /** پاس خام درگاه برای metadata */
  raw?: Record<string, unknown>;
}

export interface RefundPaymentResult {
  ok: boolean;
  providerRef?: string | null;
  message?: string;
}

export interface ParsedCallback {
  authority: string | null;
  /** ok=false یعنی کاربر پرداخت را لغو کرده یا درگاه خطا داده */
  ok: boolean;
}

export interface PaymentProvider {
  readonly name: string;
  startPayment(input: StartPaymentInput): Promise<StartPaymentResult>;
  verifyPayment(input: { authority: string; amountIrt: number }): Promise<VerifyPaymentResult>;
  refundPayment(input: { transactionId: string; amountIrt: number }): Promise<RefundPaymentResult>;
  parseCallback(input: { searchParams: URLSearchParams }): ParsedCallback;
  /** URL ادامهٔ پرداخت برای تلاش PENDING موجود (بدون ساخت authority تازه) */
  buildResumeUrl(authority: string): string;
}

import { MockPaymentProvider } from "./mock-payment";
import { ZarinpalPaymentProvider } from "./zarinpal";

/**
 * singleton فعال — انتخاب با env (بخش ۱۹).
 * اولویت:
 *   ۱. PAYMENT_PROVIDER=mock|zarinpal — انتخاب صریح
 *   ۲. اگر ZARINPAL_MERCHANT_ID ست شده → zarinpal (auto)
 *   ۳. پیش‌فرض: درگاه داخلی mock — سایت هرگز بدون درگاه گیر نمی‌کند
 */
export const paymentProvider: PaymentProvider = (() => {
  const explicit = process.env.PAYMENT_PROVIDER;
  if (explicit === "mock") return new MockPaymentProvider();
  if (explicit === "zarinpal") return new ZarinpalPaymentProvider();
  if (process.env.ZARINPAL_MERCHANT_ID) return new ZarinpalPaymentProvider();
  return new MockPaymentProvider();
})();

export interface PaymentGatewayInfo {
  /** نام فنی provider */
  name: string;
  /** برچسب فارسی برای نمایش ادمین */
  label: string;
  /** آیا پول خیالی جابه‌جا می‌شود؟ */
  demo: boolean;
}

/** اطلاعات درگاه فعال — برای کارت «سلامت سایت» داشبورد ادمین (شفافیت مالک) */
export function getPaymentGatewayInfo(): PaymentGatewayInfo {
  const p = paymentProvider;
  if (p instanceof ZarinpalPaymentProvider) {
    return p.sandbox
      ? { name: p.name, label: "زرین‌پال — سندباکس (پول خیالی)", demo: true }
      : { name: p.name, label: "زرین‌پال — درگاه واقعی", demo: false };
  }
  return { name: "mock", label: "درگاه آزمایشی داخلی (پول خیالی)", demo: true };
}
