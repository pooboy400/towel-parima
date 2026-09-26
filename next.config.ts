import type { NextConfig } from "next";

/**
 * Security hardening — فاز ۱ + M0
 * - typescript.ignoreBuildErrors حذف شد: خطاهای تایپ هرگز نباید در build نادیده گرفته شوند
 * - هدرهای امنیتی پایه روی همه مسیرها
 * - M0: CSP-Report-Only (بخش ۹.۲ سند معماری) — در M6 با nonce سخت‌گیرانه می‌شود
 *
 * نکته: X-Frame-Options فقط در production اعمال می‌شود؛ در dev، پنل پیش‌نمایش
 * سایت را داخل iframe نشان می‌دهد و این هدر باعث صفحه سفید/بلاک می‌شود.
 */
const isProduction = process.env.NODE_ENV === "production";

/**
 * CSP مرحله‌ای (بخش ۹.۲ سند) — حالت Report-Only در M0:
 * هیچ‌چیز بلاک نمی‌شود؛ فقط تخلف‌ها به /api/csp-report می‌آیند تا در M6
 * با داده واقعی، سیاست سخت‌گیرانه nonce-دار ساخته شود.
 * unsafe-inline/unsafe-eval فعلاً مجاز (Next بدون nonce نیاز دارد) —
 * signalهای واقعی ما: منابع خارجی، frame-ancestors، object-src.
 */
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // SEC-10 (فاز ۳) — افشای فریم‌ورک خاموش می‌شود (X-Powered-By: Next.js حذف)
  poweredByHeader: false,

  /**
   * Server Actions — فهرست سفید مبدأ (رفع خطای «Invalid Server Actions request»)
   * ------------------------------------------------------------------
   * درخواست‌های اکشن از طریق دامنه پیش‌نمایش (preview-chat-*.space-z.ai) عبور
   * می‌کنند؛ پروکسی واسط هدر x-forwarded-host را به آدرس داخلی خودش بازنویسی
   * می‌کند و Next این عدم تطابق را CSRF فرض کرده و اکشن را متوقف می‌کند.
   * wildcard زیردامنه‌های space-z.ai مجاز اعلام می‌شود (کوکی‌های جلسه به
   * زیردامنه خود سایت محدودند — ریسک CSRF بین‌زریردامنه‌ای ندارد).
   * M5: هنگام استقرار روی دامنه واقعی، در صورت استفاده از ریورس‌پروکسی
   * دامنه واقعی را هم به همین فهرست اضافه کنید.
   */
  experimental: {
    serverActions: {
      allowedOrigins: ["*.space-z.ai"],
      // SEC-14 (فاز ۳) — سقف بدنهٔ action بالا برده شد تا پایپ‌لاین رسانه (۵MB +
      // overhead multipart) دست‌نیافتنی نباشد؛ چک file.size قبل از arrayBuffer
      // در media/actions.ts انجام می‌شود تا فایل بزرگ قبل از RAM رد شود.
      bodySizeLimit: "6mb",
    },
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // جلوگیری از clickjacking — سایت نباید در iframe سایت‌های دیگر لود شود
          // (فقط production؛ در dev پنل پیش‌نمایش به iframe وابسته است)
          ...(isProduction
            ? [{ key: "X-Frame-Options", value: "DENY" }]
            : []),
          // جلوگیری از MIME-sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // نشت URLهای داخلی به سایت‌های دیگر هنگام خروج از سایت
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // بستن APIهای مرورگر که استفاده نمی‌شوند (دوربین/میکروفون/موقعیت)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // force HTTPS در مرورگر (فقط روی اتصال HTTPS اعمال می‌شود)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // M0 — CSP فقط گزارش (بخش ۹.۲ سند معماری)
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
          },
          {
            key: "Reporting-Endpoints",
            value: 'csp-endpoint="/api/csp-report"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
