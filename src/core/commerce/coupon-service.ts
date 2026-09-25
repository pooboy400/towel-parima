/**
 * CouponService — کوپن (بخش ۴.۳ سند)
 * ---------------------------------------------------------------
 * اعتبارسنجی خواندنی جدا از مصرفِ تراکنشی — مصرف فقط داخل tx checkout.
 * usedCount کشِ خواندنی است؛ حقیقت از CouponRedemption. اما افزایش آن در
 * همان tx مصرف انجام می‌شود تا سقف‌ها با COUNT رقابتی امن بمانند (شرط atomic).
 */

import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import type { Prisma, Coupon } from "@prisma/client";

export interface CouponEvaluation {
  code: string;
  discount: number;
  type: Coupon["type"];
  value: number;
}

type Tx = Prisma.TransactionClient;

/** تخفیف محاسبه‌شده یک کوپن روی ساب‌توتال — بدون سمتِ سقف‌ها */
export function computeDiscount(coupon: Coupon, subtotal: number): number {
  let discount =
    coupon.type === "PERCENT"
      ? Math.floor((subtotal * coupon.value) / 100)
      : coupon.value;
  if (coupon.type === "PERCENT" && coupon.maxDiscount !== null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  // تخفیف هرگز از ساب‌توتال عبور نمی‌کند
  return Math.max(0, Math.min(discount, subtotal));
}

/**
 * اعتبارسنجی خواندنی کوپن — برای UI و پیش‌نمایش تخفیف.
 * مصرفِ نهایی در consumeCouponInTx با همان قواعد + گارد اتمیک سقف انجام می‌شود.
 */
export async function evaluateCoupon(
  codeRaw: string,
  subtotal: number,
  userId?: string | null,
): Promise<CouponEvaluation> {
  const code = codeRaw.trim().toUpperCase();
  if (!code) {
    throw new DomainError("COUPON_INVALID", "کد تخفیف را وارد کنید.");
  }

  const coupon = await db.coupon.findFirst({
    where: { code, isActive: true, deletedAt: null },
  });
  if (!coupon) {
    throw new DomainError("COUPON_INVALID", "کد تخفیف معتبر نیست.");
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new DomainError("COUPON_INVALID", "این کد تخفیف هنوز فعال نشده است.");
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new DomainError("COUPON_INVALID", "این کد تخفیف منقضی شده است.");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new DomainError("COUPON_INVALID", "ظرفیت این کد تخفیف پر شده است.");
  }
  if (coupon.perUserLimit !== null && userId) {
    const usedByUser = await db.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    });
    if (usedByUser >= coupon.perUserLimit) {
      throw new DomainError(
        "COUPON_INVALID",
        "شما قبلاً حداکثر استفاده مجاز از این کد را داشته‌اید.",
      );
    }
  }
  if (coupon.minSubtotal !== null && subtotal < coupon.minSubtotal) {
    throw new DomainError(
      "COUPON_INVALID",
      "مبلغ سبد خرید برای این کد کافی نیست.",
    );
  }

  return {
    code: coupon.code,
    discount: computeDiscount(coupon, subtotal),
    type: coupon.type,
    value: coupon.value,
  };
}

/**
 * مصرف تراکنشی کوپن — فقط داخل tx checkout.
 * گارد اتمیک سقف: UPDATE شرطی usageLimit — اگر ردیف آپدیت نشد یعنی سقف در همین
 * لحظه توسط تراکنش دیگری پر شده (race-safe).
 */
export async function consumeCouponInTx(
  tx: Tx,
  input: { couponId: string; orderId: string; userId?: string | null },
): Promise<void> {
  const coupon = await tx.coupon.findUnique({
    where: { id: input.couponId },
  });
  if (!coupon || !coupon.isActive || coupon.deletedAt) {
    throw new DomainError("COUPON_INVALID", "کد تخفیف معتبر نیست.");
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new DomainError("COUPON_INVALID", "این کد تخفیف هنوز فعال نشده است.");
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new DomainError("COUPON_INVALID", "این کد تخفیف منقضی شده است.");
  }

  if (coupon.usageLimit !== null) {
    // مصرف اتمیک ظرفیت: شرط usedCount < usageLimit در همان UPDATE
    const updated = await tx.$executeRaw`
      UPDATE "Coupon"
      SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
      WHERE "id" = ${coupon.id}
        AND "isActive" = true
        AND "deletedAt" IS NULL
        AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
    if (updated === 0) {
      throw new DomainError("COUPON_INVALID", "ظرفیت این کد تخفیف پر شده است.");
    }
  } else {
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    });
  }

  if (coupon.perUserLimit !== null && input.userId) {
    const usedByUser = await tx.couponRedemption.count({
      where: { couponId: coupon.id, userId: input.userId },
    });
    if (usedByUser >= coupon.perUserLimit) {
      throw new DomainError(
        "COUPON_INVALID",
        "شما قبلاً حداکثر استفاده مجاز از این کد را داشته‌اید.",
      );
    }
  }

  await tx.couponRedemption.create({
    data: {
      couponId: coupon.id,
      orderId: input.orderId,
      userId: input.userId ?? null,
    },
  });
}
