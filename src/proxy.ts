/**
 * Proxy (Middleware سابق) — محافظ مسیر (لایه اول، بخش ۲.۱ سند معماری)
 * ---------------------------------------------------------------
 * ⚠️ این لایه «مرز امنیت» نیست — فقط گارد ارزان مسیر است؛
 * منبع حقیقت requirePermission داخل هر handler است (بخش ۲.۲ سند).
 *
 * فاز ۳: گاردهای عمومی (BUG-12/3 طول URL · BUG-14 Origin) برای همهٔ مسیرها
 * فاز ۶ (INFRA-03): CSP مرحله‌ای روی همهٔ پاسخ‌ها — production=ENFORCE با
 * nonce+strict-dynamic، dev=Report-Only (HMR/پیش‌نمایش نشکند)
 * M0: گارد ادمین — بدون کوکی، /admin به صفحهٔ ورود ریدایرکت می‌شود
 * نکته Next.js 16: قرارداد middleware.ts به proxy.ts تغییر نام یافت.
 */

import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { randomUUID } from "node:crypto";
import { ADMIN_SESSION_COOKIE, MIN_SESSION_TOKEN_LENGTH } from "@/core/auth/cookies";
import { buildCsp } from "@/lib/csp";
import { isAllowedOrigin } from "@/lib/allowed-origins";

/** فاز ۳ (BUG-12/3) — سقف طول URL: query عظیم 400 ساختاریافته می‌گیرد */
const MAX_URL_LENGTH = 2048;

export function proxy(request: NextRequest, _event?: NextFetchEvent) {
  // ── فاز ۳ — گاردهای عمومی
  // BUG-12/3: URL با query عظیم → 400 JSON ساختاریافته (نه خطای عمومی)
  if (request.url.length > MAX_URL_LENGTH) {
    return NextResponse.json(
      { ok: false, code: "URI_TOO_LONG", message: "آدرس درخواست بیش از حد طولانی است." },
      { status: 400 },
    );
  }
  // BUG-14: Origin قابل‌پارسِ خارج از مبدأ → 403 تمیز (نه 500 خام فریم‌ورک)؛
  // Origin «null»/غایب به فریم‌ورک واگذار می‌شود (رفتار سندبکس‌های خاص حفظ است)
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      if (originHost) {
        const host =
          request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
        if (host && !isAllowedOrigin(originHost, host)) {
          return NextResponse.json(
            { ok: false, code: "FORBIDDEN_ORIGIN", message: "درخواست از مبدأ غیرمجاز رد شد." },
            { status: 403 },
          );
        }
      }
    }
  }

  // ── INFRA-03 (فاز ۶) — CSP برای همهٔ پاسخ‌ها (قبل از هر early-return):
  // production=ENFORCE با nonce، dev=Report-Only. هدر روی request هم ست می‌شود
  // تا Next خودش nonce را به اسکریپت‌های bootstrap اضافه کند (الگوی رسمی).
  const isProduction = process.env.NODE_ENV === "production";
  const nonce = isProduction
    ? Buffer.from(randomUUID()).toString("base64")
    : undefined;
  const { policy, reportOnly } = buildCsp({ nonce, isProduction });
  const cspHeaderName = reportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", policy);
  }

  /** همهٔ مسیرهای خروجی CSP/Reporting می‌گیرند — بدون استثنا */
  const withCsp = (response: NextResponse): NextResponse => {
    response.headers.set(cspHeaderName, policy);
    response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');
    return response;
  };

  const nextWithCsp = () =>
    withCsp(NextResponse.next({ request: { headers: requestHeaders } }));

  // گارد ادمین فقط روی مسیرهای /admin اعمال می‌شود
  if (!request.nextUrl.pathname.startsWith("/admin")) return nextWithCsp();

  // صفحه ورود بدون کوکی باید در دسترس باشد — وگرنه حلقه ریدایرکت
  if (request.nextUrl.pathname === "/admin/login") return nextWithCsp();

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const hasSession = Boolean(token && token.length >= MIN_SESSION_TOKEN_LENGTH);

  if (!hasSession) {
    const loginUrl = new URL("/admin/login", request.url);
    // برگرداندن مقصد برای پرش بعد از ورود — بدون نشت URLهای خارجی
    const next = request.nextUrl.pathname;
    if (next.startsWith("/admin")) loginUrl.searchParams.set("next", next);
    return withCsp(NextResponse.redirect(loginUrl));
  }

  return nextWithCsp();
}

export const config = {
  // فاز ۳: از فقط-/admin به همه‌مسیرهای غیراستاتیک گسترش یافت (BUG-14/12 برای
  // همهٔ POSTها) — گارد ادمین داخل proxy با startsWith("/admin") محدود مانده
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
