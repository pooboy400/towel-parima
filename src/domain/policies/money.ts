/**
 * Policy — پول، تخفیف و کوپن (بخش ۱۲ سند معماری)
 * ---------------------------------------------------------------
 * قوانین قطعی:
 * - همه مبالغ Integer به IRT — هیچ Float وارد محاسبات مالی نمی‌شود.
 * - گرد کردن فقط در درصد کوپن و با floor (اختلاف ریالی به نفع مشتری).
 * - compareAtPrice صرفاً نمایشی است.
 */

import type { Coupon } from "../models/commerce";
import { DomainError } from "../../core/errors";

/** اطمینان از Integer بودن مبلغ — مرز ورود هر مبلغ به منطق مالی */
export function assertMoney(value: number, label = "amount"): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "مبلغ نامعتبر است.",
      undefined,
      { field: label },
    );
  }
}

/** جمع خطی سبد: Σ(unitPrice × quantity) */
export function calcSubtotal(lines: readonly { unitPrice: number; quantity: number }[]): number {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  assertMoney(subtotal, "subtotal");
  return subtotal;
}

export interface CouponCalcInput {
  subtotal: number;
  coupon: Pick<Coupon, "type" | "value" | "maxDiscount" | "minSubtotal">;
}

export interface CouponCalcResult {
  /** مبلغ تخفیف نهایی — IRT Integer */
  discount: number;
}

/**
 * محاسبه تخفیف کوپن — بدون اعتبارسنجی eligibility (آن کار CouponService است).
 * - PERCENT: floor(subtotal × value / 100) با سقف maxDiscount
 * - FIXED: min(value, subtotal) — تخفیف هرگز از سبد بیشتر نمی‌شود
 */
export function calcCouponDiscount({ subtotal, coupon }: CouponCalcInput): CouponCalcResult {
  assertMoney(subtotal, "subtotal");

  let discount: number;
  if (coupon.type === "PERCENT") {
    if (!Number.isInteger(coupon.value) || coupon.value < 1 || coupon.value > 100) {
      throw new DomainError("COUPON_INVALID", "درصد کوپن نامعتبر است.");
    }
    discount = Math.floor((subtotal * coupon.value) / 100);
    if (coupon.maxDiscount !== null && coupon.maxDiscount !== undefined) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    if (!Number.isInteger(coupon.value) || coupon.value < 0) {
      throw new DomainError("COUPON_INVALID", "مبلغ کوپن نامعتبر است.");
    }
    discount = Math.min(coupon.value, subtotal);
  }

  assertMoney(discount, "discount");
  return { discount };
}

export interface TotalsInput {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  /** پیش‌فرض ۰ — فروشگاه B2C فاز اول بدون مالیات */
  taxTotal?: number;
}

/** grandTotal = subtotal − discount + shipping + tax — همیشه Integer و ≥ ۰ */
export function calcGrandTotal({
  subtotal,
  discountTotal,
  shippingTotal,
  taxTotal = 0,
}: TotalsInput): number {
  assertMoney(subtotal, "subtotal");
  assertMoney(discountTotal, "discountTotal");
  assertMoney(shippingTotal, "shippingTotal");
  assertMoney(taxTotal, "taxTotal");
  const total = subtotal - discountTotal + shippingTotal + taxTotal;
  if (total < 0) {
    throw new DomainError("VALIDATION_ERROR", "مبلغ نهایی منفی شد — خطای محاسبه تخفیف.");
  }
  return total;
}

/** هزینه ارسال بر اساس سیاست فروشگاه — IRT
 * BUG-08 (فاز ۳) — تنها فرمول ارسال؛ مسیر زندهٔ checkout هم از همین عبور می‌کند.
 * گارد subtotal=0: سبد خالی هرگز هزینهٔ ارسال ندارد (خطای «سبد خالی» بالادست است).
 */
export function calcShipping(
  subtotal: number,
  config: { flatFee: number; freeThreshold: number },
  method: "standard" | "express" = "standard",
  expressFee = 0,
): number {
  if (subtotal <= 0) return 0;
  if (subtotal >= config.freeThreshold) return 0;
  if (method === "express") return expressFee;
  return config.flatFee;
}
