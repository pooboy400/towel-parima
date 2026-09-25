/**
 * Checkout Callback — بازگشت از درگاه پرداخت (بخش ۱۰.۲)
 * GET /checkout/callback?authority=...&status=OK|NOK
 * verify سمت سرور → claim اتمیک → redirect به نتیجه.
 */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { confirmPayment, failPayment } from "@/core/commerce/payment-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
      return NextResponse.redirect(
        new URL(
          `/checkout/success${orderCode ? `?code=${encodeURIComponent(orderCode)}` : ""}`,
          request.url,
        ),
      );
    }
    return NextResponse.redirect(new URL("/checkout/failed", request.url));
  } catch (error) {
    console.error("checkout callback failed:", error);
    return NextResponse.redirect(new URL("/checkout/failed", request.url));
  }
}
