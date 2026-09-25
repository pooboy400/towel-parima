/**
 * Checkout Actions — ثبت سفارش تراکنشی + شروع پرداخت (M3)
 * ---------------------------------------------------------------
 * زنجیره: Zod → resolve واریانت از DB → placeOrder (tx §10.1) → startPayment
 * → redirectUrl به درگاه. خطای DomainError با استاندارد §24 به کلاینت می‌رسد.
 * قیمت هرگز از کلاینت پذیرفته نمی‌شود — کلاینت فقط lineId و تعداد می‌فرستد.
 */

"use server";

import { headers, cookies } from "next/headers";
import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { getCustomerContext } from "@/core/auth/customer-session";
import { rateLimiter, RATE_RULES, rateKey } from "@/core/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import {
  placeOrder,
  PAY_PROOF_COOKIE,
  PAY_PROOF_TTL_S,
  paidProofValue,
} from "@/core/commerce/checkout-service";
import { evaluateCoupon } from "@/core/commerce/coupon-service";
import { startPayment } from "@/core/commerce/payment-service";
import {
  placeOrderSchema,
  type PlaceOrderActionInput,
} from "@/domain/schemas/commerce";

/** شکل امن خط سبد کلاینت */
export interface ClientLineInput {
  lineId: string;
  quantity: number;
  name?: string;
}

interface TripleLine {
  productId: string;
  colorId: string | null;
  sizeId: string | null;
  quantity: number;
  name?: string;
}

/** تبدیل lineId کلاینت (productId__colorId__sizeId) به سه‌تایی دامنه */
function parseLineId(lineId: string): {
  productId: string;
  colorId: string | null;
  sizeId: string | null;
} | null {
  const parts = lineId.split("__");
  if (parts.length !== 3 || !parts[0]) return null;
  return {
    productId: parts[0],
    colorId: parts[1] === "-" ? null : parts[1],
    sizeId: parts[2] === "-" ? null : parts[2],
  };
}

function toCheckoutLines(lines: ClientLineInput[]): TripleLine[] {
  const merged = new Map<string, TripleLine>();
  for (const line of lines) {
    const triple = parseLineId(line.lineId);
    if (!triple) {
      throw new DomainError("VALIDATION_ERROR", "سبد خرید نامعتبر است.");
    }
    const key = line.lineId;
    const prev = merged.get(key);
    merged.set(key, {
      ...triple,
      quantity: Math.min((prev?.quantity ?? 0) + Math.max(1, line.quantity), 20),
      name: line.name ?? prev?.name,
    });
  }
  return [...merged.values()];
}

/** قیمت واریانت‌های resolve‌شده — منبع ساب‌توتال برای کوپن */
async function priceResolvedLines(lines: TripleLine[]): Promise<number> {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const candidates = await db.variant.findMany({
    where: {
      productId: { in: productIds },
      deletedAt: null,
      isActive: true,
      product: { is: { deletedAt: null, status: "ACTIVE" } },
    },
    select: { id: true, price: true, colorId: true, sizeId: true, productId: true },
  });
  let subtotal = 0;
  for (const line of lines) {
    const variant = candidates.find(
      (v) =>
        v.productId === line.productId &&
        (v.colorId ?? null) === line.colorId &&
        (v.sizeId ?? null) === line.sizeId,
    );
    if (!variant) {
      throw new DomainError("OUT_OF_STOCK", "یکی از کالاهای سبد قابل خرید نیست.");
    }
    subtotal += variant.price * line.quantity;
  }
  return subtotal;
}

/** پیش‌نمایش کوپن — با ساب‌توتالِ قیمتِ سروری
 * rate-limit: couponApply (10/10min per IP+user) — توقف brute-force کد تخفیف (HIGH-2 گزارش 47-a)
 */
export async function validateCouponAction(input: {
  code: string;
  lines: ClientLineInput[];
}): Promise<{ ok: true; discount: number } | { ok: false; message: string }> {
  try {
    const customer = await getCustomerContext();
    const ip = (await getClientIp()) ?? "unknown";
    const rl = await rateLimiter.hit(
      rateKey("coupon-apply", ip, customer?.userId ?? "guest"),
      RATE_RULES.couponApply,
    );
    if (!rl.ok) {
      return { ok: false, message: "تلاش‌های بررسی کد تخفیف زیاد بوده؛ چند دقیقه بعد دوباره امتحان کنید." };
    }

    const lines = toCheckoutLines(input.lines);
    const subtotal = await priceResolvedLines(lines);
    const evaluation = await evaluateCoupon(input.code, subtotal, customer?.userId ?? null);
    return { ok: true, discount: evaluation.discount };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("validateCouponAction failed:", error);
    return { ok: false, message: "بررسی کد تخفیف ناموفق بود." };
  }
}

/**
 * ثبت سفارش + شروع پرداخت — خروجی redirectUrl درگاه.
 * مهمان هم می‌تواند سفارش دهد (userId null — تلفن مستقل روی Order).
 */
export async function placeOrderAction(
  input: PlaceOrderActionInput,
): Promise<{ ok: true; redirectUrl: string; orderCode: string } | { ok: false; message: string }> {
  try {
    const parsed = placeOrderSchema.parse(input);
    const customer = await getCustomerContext();

    const ip = (await getClientIp()) ?? "unknown";
    const userAgent = (await headers()).get("user-agent");

    // rate-limit: paymentStart (5/10min per IP+user) — اسپم سفارش PENDING/رزرو/درگاه (HIGH-2)
    const rl = await rateLimiter.hit(
      rateKey("payment-start", ip, customer?.userId ?? "guest"),
      RATE_RULES.paymentStart,
    );
    if (!rl.ok) {
      return { ok: false, message: "تعداد ثبت سفارش زیاد است؛ چند دقیقه بعد دوباره تلاش کنید." };
    }

    const result = await placeOrder({
      userId: customer?.userId ?? null,
      lines: toCheckoutLines(parsed.lines),
      address: parsed.address,
      shippingMethod: parsed.shippingMethod,
      couponCode: parsed.couponCode ?? null,
      note: parsed.note ?? null,
    });

    const payment = await startPayment({
      orderId: result.orderId,
      userId: customer?.userId ?? null,
    });

    // SEC-07 — اثبات کوتاه‌عمر ورود به درگاه mock؛ مهمان هم بدون اصطکاک دارد
    // (فقط پرداخت‌کنندهٔ واقعی این کوکی را دارد — authority در لاگ/Referer نشت‌پذیر است)
    if (payment.redirectUrl.includes("/mock-gateway")) {
      const jar = await cookies();
      jar.set({
        name: PAY_PROOF_COOKIE,
        value: paidProofValue(payment.authority),
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: PAY_PROOF_TTL_S,
        secure: process.env.NODE_ENV === "production",
      });
    }

    return {
      ok: true,
      redirectUrl: payment.redirectUrl,
      orderCode: result.orderCode,
    };
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, message: error.message };
    }
    console.error("placeOrderAction failed:", error);
    return { ok: false, message: "ثبت سفارش ناموفق بود — دوباره تلاش کنید." };
  }
}
