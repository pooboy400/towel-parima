/**
 * Policy — موجودی (بخش ۱۳ سند معماری)
 * ---------------------------------------------------------------
 * حقیقت قابل‌فروش: available = stock − reserved.
 * UPDATE اتمیک رزرو (SQL شرطی) در M1 در InventoryService پیاده می‌شود؛
 * اینجا منطق خالص تصمیم‌گیری و توضیح قیدهاست — تست‌پذیر بدون دیتابیس.
 */

export interface StockLevels {
  stock: number;
  reserved: number;
}

export function availableOf({ stock, reserved }: StockLevels): number {
  return stock - reserved;
}

export type ReserveDecision = "OK" | "OUT_OF_STOCK" | "INACTIVE";

/** آیا رزرو qty از این واریانت ممکن است؟ — پیش‌شرط‌های UPDATE شرطی */
export function canReserve(
  v: StockLevels & { isActive: boolean; deletedAt?: Date | null },
  qty: number,
): ReserveDecision {
  if (!v.isActive || v.deletedAt) return "INACTIVE";
  if (!Number.isInteger(qty) || qty < 1) return "OUT_OF_STOCK";
  return availableOf(v) >= qty ? "OK" : "OUT_OF_STOCK";
}

/** TTL رزرو — ۲۰ دقیقه پنجره پرداخت (بخش ۱۳ سند) */
export const RESERVATION_TTL_MS = 20 * 60_000;

/** آیا رزرو منقضی شده؟ — مبنای worker انقضا (هر ۵ دقیقه) */
export function isReservationExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** TTL کد تخفیف پرداخت روی callback — هم‌تراز با پنجره پرداخت */
export function reservationExpiry(now = new Date(), ttlMs = RESERVATION_TTL_MS): Date {
  return new Date(now.getTime() + ttlMs);
}
