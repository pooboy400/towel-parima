/**
 * Policy — مرجوعی (بخش ۵.۱ سند: DELIVERED → RETURN_REQUESTED)
 * ---------------------------------------------------------------
 * بازه مرجوعی از StoreSettings.shipping.returnWindowDays خوانده می‌شود
 * (پیش‌فرض ۷ روز) — عدد جادویی در کد ممنوع.
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
