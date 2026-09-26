/**
 * Policy — مرجوعی (بخش ۵.۱ سند: DELIVERED → RETURN_REQUESTED)
 * ---------------------------------------------------------------
 * بازه مرجوعی از StoreSettings.shipping.returnWindowDays خوانده می‌شود
 * (پیش‌فرض ۷ روز) — عدد جادویی در کد ممنوع.
 *
 * BUG-15 (فاز ۳ — ADR ثبت‌شده): این policy فعلاً هیچ مسیر فراخوانی‌ای ندارد
 * چون فیچر «درخواست مرجوعی مشتری» هنوز ساخته نشده (گذار DELIVERED→
 * RETURN_REQUESTED بازیگر customer بدون consumer است). وقتی مسیر ساخته شد
 * «باید» از همین توابع عبور کند (تست integration پنجرهٔ مرجوعی الزامی)؛
 * ادعای UI «۷ روز مرجوعی» تا آن زمان بدون پشتوانهٔ مسیر است — شناخته‌شده.
 */

export interface ReturnWindowInput {
  deliveredAt: Date;
  requestedAt: Date;
  /** روز — از تنظیمات فروشگاه */
  returnWindowDays: number;
}

export function isWithinReturnWindow({
  deliveredAt,
  requestedAt,
  returnWindowDays,
}: ReturnWindowInput): boolean {
  if (returnWindowDays <= 0) return false;
  const diffMs = requestedAt.getTime() - deliveredAt.getTime();
  return diffMs >= 0 && diffMs <= returnWindowDays * 24 * 60 * 60_000;
}
