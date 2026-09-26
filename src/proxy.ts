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

/** فاز ۳ (BUG-12/3) — سقف طول URL: query عظیم 400 ساختاریافته می‌گیرد */
const MAX_URL_LENGTH = 2048;

/** فاز ۳ (BUG-14) — مبدأ مجاز: خودِ هاست یا فهرست سفید سندباکس (هم‌راستا با next.config) */
function isAllowedOrigin(originHost: string, host: string): boolean {
  if (originHost === host) return true;
  // INFRA-06: در دیپلوی واقعی زیردامنه‌های سندباکس از فهرست حذف شوند
  return originHost.endsWith(".space-z.ai") && host.endsWith(".space-z.ai");
}

export function proxy(request: NextRequest) {
  // ── فاز ۳ — گاردهای عمومی (قبل از گارد ادمین)
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

  // گارد ادمین فقط روی مسیرهای /admin اعمال می‌شود
  if (!request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();

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
  // فاز ۳: از فقط-/admin به همه‌مسیرهای غیراستاتیک گسترش یافت (BUG-14/12 برای
  // همهٔ POSTها) — گارد ادمین داخل proxy با startsWith("/admin") محدود مانده
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
