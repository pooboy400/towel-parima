import { NextRequest, NextResponse } from "next/server";
import { rateLimiter, RATE_RULES, rateKey } from "@/core/rate-limit";

/**
 * POST /api/csp-report — دریافت گزارش تخلف CSP (بخش ۹.۲ سند معماری)
 * ---------------------------------------------------------------
 * M0: CSP-Report-Only فعال است و مرورگرها تخلف‌ها را اینجا می‌فرستند.
 * M6: با تحلیل این گزارش‌ها، سیاست سخت‌گیرانه nonce-دار ساخته می‌شود.
 *
 * امنیت endpoint:
 * - rate limit ۳۰/IP/دقیقه (مرورگر سالم به این سقف نمی‌خورد)
 * - هیچ ذخیره‌سازی حساسی ندارد؛ فقط لاگ JSON ساخت‌یافته
 * - بدنه هرچه باشد 204 برمی‌گرداند (مرورگر انتظار پاسخ ندارد)
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = rateKey("csp-report", ip);

  const { ok } = await rateLimiter.hit(key, RATE_RULES.search);
  if (!ok) {
    // حتی در سقف هم 204 — مرورگر را گمراه نکنیم
    return new NextResponse(null, { status: 204 });
  }

  try {
    const report = await request.json();
    // لاگ یک‌خطی JSON — در M6 به error tracking می‌رود
    console.log(
      JSON.stringify({
        level: "warn",
        type: "csp_violation",
        ts: new Date().toISOString(),
        ip,
        report,
      }),
    );
  } catch {
    // بدنه خراب = بی‌اهمیت؛ بی‌صدا رد شود
  }

  return new NextResponse(null, { status: 204 });
}
