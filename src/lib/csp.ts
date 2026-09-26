/**
 * CSP Builder — INFRA-03 (فاز ۶)
 * ---------------------------------------------------------------
 * ساختار سیاست CSP مرحله‌ای (بخش ۹.۲ سند):
 *  · production: ENFORCE با nonce + strict-dynamic — unsafe-eval حذف
 *  · dev: Report-Only با unsafe-inline/eval (HMR/React Refresh نیاز دارد)
 *  · style-src 'unsafe-inline' می‌ماند (Next inline styles — قابل قبول سند)
 *  · img-src https: برای تصاویر راه‌دور آینده محدود به data:/blob: می‌شود در صورت نیاز
 * pure است تا در unit تست و proxy هر دو استفاده شود.
 */

export interface CspOptions {
  /** nonce پایهٔ ۶۴ برای script-src — فقط production */
  nonce?: string;
  /** محیط production؟ */
  isProduction: boolean;
}

export function buildCsp(opts: CspOptions): {
  policy: string;
  reportOnly: boolean;
} {
  const scriptSrc = opts.isProduction
    ? `'self' 'nonce-${opts.nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-inline' 'unsafe-eval'`;

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Next استایل inline تزریق می‌کند — طبق راهنمای رسمی Next قابل قبول است
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ];

  return {
    policy: directives.join("; "),
    // enforce فقط در production؛ dev گزارش‌محور می‌ماند (پیش‌نمایش/HMR نشکند)
    reportOnly: !opts.isProduction,
  };
}
