/**
 * Checkout Callback — بازگشت از درگاه پرداخت (بخش ۱۰.۲)
 * GET /checkout/callback?authority=...&status=OK|NOK
 * verify سمت سرور → claim اتمیک → redirect به نتیجه.
 */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { rateLimiter } from "@/core/rate-limit";
import { RATE_RULES, rateKey } from "@/core/rate-limit/policies";
import { extractClientIp } from "@/lib/client-ip";
import {
  confirmPayment,
  failPayment,
} from "@/core/commerce/payment-service";
import {
  PAY_PROOF_COOKIE,
  PAY_PROOF_TTL_S,
  paidProofValue,
} from "@/core/commerce/checkout-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // فاز ۳ (پیشنهاد 60-hack) — سقف سبک روی callback: فلود بدون authority هم
  // ارزان رد می‌شود؛ پاسخ همان redirect مسیر خطاست (بدون افشا)
  const ip = extractClientIp(request.headers) ?? "unknown";
  const rl = await rateLimiter.hit(rateKey("checkout-callback", ip), RATE_RULES.publicApi);
  if (!rl.ok) {
    return NextResponse.redirect(new URL("/checkout/failed", request.url));
  }

  const { searchParams } = new URL(request.url);
  const authority = searchParams.get("authority");
  const status = searchParams.get("status");

  if (!authority) {
    return NextResponse.redirect(new URL("/checkout?error=payment", request.url));
  }

  try {
    const orderCode = await db.payment
      .findUnique({ where: { authority }, select: { order: { select: { code: true } } } })
      .then((p) => p?.order.code ?? null);

    if (status === "NOK") {
      await failPayment({ authority, reason: "پرداخت توسط کاربر لغو شد." });
      return NextResponse.redirect(new URL("/checkout/failed", request.url));
    }

    const result = await confirmPayment(authority);
    if (result.ok) {
      // SEC-04 — اثبات کوتاه‌عمر بازگشت موفق؛ فقط پرداخت‌کنندهٔ واقعی (صاحب authority)
      // این کوکی را دارد → صفحهٔ success جزئیات سفارش را نشان می‌دهد.
      const response = NextResponse.redirect(
        new URL(
          `/checkout/success${orderCode ? `?code=${encodeURIComponent(orderCode)}` : ""}`,
          request.url,
        ),
      );
      response.cookies.set({
        name: PAY_PROOF_COOKIE,
        value: paidProofValue(authority),
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: PAY_PROOF_TTL_S,
        secure: process.env.NODE_ENV === "production",
      });
      return response;
    }
    return NextResponse.redirect(new URL("/checkout/failed", request.url));
  } catch (error) {
    // BUG-12 (فاز ۳) — DomainError موردانتظرهٔ callback یک‌خطی لاگ می‌شود؛
    // استک کامل فقط برای خطای غیرمنتظره
    if (error instanceof DomainError) {
      console.warn(
        "checkout callback domain error:",
        error.code,
        "-",
        error.message,
      );
    } else {
      console.error("checkout callback failed:", error);
    }
    return NextResponse.redirect(new URL("/checkout/failed", request.url));
  }
}
