/**
 * Proxy (Middleware سابق) — محافظ مسیر (لایه اول، بخش ۲.۱ سند معماری)
 * ---------------------------------------------------------------
 * ⚠️ این لایه «مرز امنیت» نیست — فقط گارد ارزان مسیر است؛
 * منبع حقیقت requirePermission داخل هر handler است (بخش ۲.۲ سند).
 *
 * M0: فقط /admin — اگر کوکی ادمین نبود، ریدایرکت به صفحه ورود ادمین.
 *     (صفحه ورود در M2 ساخته می‌شود؛ تا آن زمان /admin وجود خارجی ندارد.)
 *
 * کارایی: matcher فقط /admin را می‌گیرد — صفحات فروشگاه عمومی از این
 * لایه عبور نمی‌کنند و هیچ سرباری به آن‌ها اضافه نمی‌شود.
 * نکته Next.js 16: قرارداد middleware.ts به proxy.ts تغییر نام یافت.
 */

import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, MIN_SESSION_TOKEN_LENGTH } from "@/core/auth/cookies";

export function proxy(request: NextRequest) {
  // صفحه ورود بدون کوکی باید در دسترس باشد — وگرنه حلقه ریدایرکت
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const hasSession = Boolean(token && token.length >= MIN_SESSION_TOKEN_LENGTH);

  if (!hasSession) {
    const loginUrl = new URL("/admin/login", request.url);
    // برگرداندن مقصد برای پرش بعد از ورود — بدون نشت URLهای خارجی
    const next = request.nextUrl.pathname;
    if (next.startsWith("/admin")) loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
