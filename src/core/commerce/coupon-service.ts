/**
 * CouponService — کوپن (بخش ۴.۳ سند)
 * ---------------------------------------------------------------
 * اعتبارسنجی خواندنی جدا از مصرفِ تراکنشی — مصرف فقط داخل tx checkout.
 * usedCount کشِ خواندنی است؛ حقیقت از CouponRedemption. اما افزایش آن در
 * همان tx مصرف انجام می‌شود تا سقف‌ها با COUNT رقابتی امن بمانند (شرط atomic).
 *
 * BUG-01 (فاز ۲ — TOCTOU سقف perUserLimit):
 *   شمارش count-then-create بدون قفل نسبت به چک‌اوتِ همزمانِ یک کاربر ناامن بود
 *   (سقف ۱ → دو مصرف). راه‌حل: قفل pessimistic ردیف Coupon با SELECT … FOR UPDATE
 *   در ابتدای consumeCouponInTx (همان الگوی refund-service.ts) — همهٔ مصرف‌های
 *   همزمانِ یک کوپن سریال می‌شوند و شمارش سقف کاربر در پنجرهٔ قفل نهایی و امن است.
 *   گارد شرطی UPDATE ظرفیت کلی (usageLimit) هم به‌عنوان لایهٔ دوم باقی مانده است.
 *
 * BUG-02 (فاز ۲ — ADR سقف مهمان):
 *   شرط قبلی «perUserLimit && userId» یعنی مهمان کاملاً از سقف خارج بود و با هر
 *   شماره/آدرس جدید می‌توانست بی‌نهایت مصرف کند. تصمیم ثبت‌شده (ADR):
 *   مهمان هویت پایدار ندارد (شماره تماس/ایمیل قابل جعل است)؛ بنابراین همهٔ
 *   مهمان‌ها برای هر کوپن یک «سبد سهمیهٔ گمنام مشترک» دارند — یعنی مجموع مصرف
 *   مهمان‌های کل سایت ≤ perUserLimit. کوپن‌های perUserLimit عملاً برای کاربران
 *   لاگین طراحی شده‌اند و پیام خطای مهمان هم همین را پیشنهاد می‌دهد.
 *   نکتهٔ محافظه‌کارانه: ردیف‌های Redemption که userId آن‌ها با حذف حساب
 *   کاربر null شده (onDelete: SetNull) نیز به سبد گمنام شمرده می‌شوند —
 *   سخت‌گیری عمدی؛ مسیر جایگزین (شماره تماس روی Order) قابل جعل بود و
 *   معیار پذیرش («مهمان با ۳ شمارهٔ مختلف → فقط ۱ مصرف») را پاس نمی‌کرد.
 */

import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import { calcCouponDiscount } from "@/domain/policies/money";
import type { Prisma, Coupon } from "@prisma/client";

export interface CouponEvaluation {
  code: string;
  discount: number;
  type: Coupon["type"];
  value: number;
}

type Tx = Prisma.TransactionClient;

/** تخفیف محاسبه‌شده یک کوپن روی ساب‌توتال — بدون سمتِ سقف‌ها
 * BUG-08 (فاز ۳) — یک فرمول: ریاضی تخفیف فقط در money.calcCouponDiscount است؛
 * این تابع فقط پوشش دامنه‌ای است تا سه کپی موازی واگرا نشوند.
 */
export function computeDiscount(coupon: Coupon, subtotal: number): number {
  return calcCouponDiscount({ subtotal, coupon }).discount;
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
  // BUG-02 — سقف per-user/مهمان در مسیر خواندنی (پیش‌نمایش UI؛ enforce نهایی در consume)
  if (coupon.perUserLimit !== null) {
    const usedByUser = await db.couponRedemption.count({
      where: { couponId: coupon.id, userId: userId ?? null },
    });
    if (usedByUser >= coupon.perUserLimit) {
      throw new DomainError(
        "COUPON_INVALID",
        userId
          ? "شما قبلاً حداکثر استفاده مجاز از این کد را داشته‌اید."
          : "ظرفیت این کد برای خرید مهمان پر شده — با ورود به حساب کاربری دوباره امتحان کنید.",
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
  // BUG-01 — قفل ردیف کوپن: همهٔ مصرف‌های همزمانِ این کوپن اینجا سریال می‌شوند؛
  // شمارش سقف کاربر/مهمان پس از این نقطه نسبت به رقابت امن است.
  await tx.$queryRaw`SELECT "id" FROM "Coupon" WHERE "id" = ${input.couponId} FOR UPDATE`;

  // بازخوانی پس از قفل — وضعیت تازه در پنجرهٔ قفل
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

  // BUG-01 — سقف per-user اکنون زیر قفل ردیف کوپن است (بدون TOCTOU)
  // BUG-02 — مهمان: userId=null → شمارش روی سبد گمنام مشترک (ADR بالای فایل)
  if (coupon.perUserLimit !== null) {
    const usedByUser = await tx.couponRedemption.count({
      where: { couponId: coupon.id, userId: input.userId ?? null },
    });
    if (usedByUser >= coupon.perUserLimit) {
      throw new DomainError(
        "COUPON_INVALID",
        input.userId
          ? "شما قبلاً حداکثر استفاده مجاز از این کد را داشته‌اید."
          : "ظرفیت این کد برای خرید مهمان پر شده — با ورود به حساب کاربری دوباره امتحان کنید.",
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
