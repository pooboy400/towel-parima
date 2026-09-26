import type { NextConfig } from "next";
import { allowedOrigins } from "./src/lib/allowed-origins";

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
      // INFRA-06 (فاز ۶): منبع یگانه فهرست = src/lib/allowed-origins.ts —
      // در دیپلوی واقعی SERVER_ACTIONS_ALLOWED_ORIGINS ست می‌شود و wildcard سندباکس حذف
      allowedOrigins: allowedOrigins(),
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
          // INFRA-03 (فاز ۶): CSP به proxy.ts منتقل شد (nonce-aware) —
          // اینجا دیگر هدر CSP تکراری نمی‌آید (دو CSP = سخت‌گیرترین تفسیر)
        ],
      },
    ];
  },
};

export default nextConfig;
