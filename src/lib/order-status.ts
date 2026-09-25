/**
 * Order Status Labels — برچسب فارسی وضعیت سفارش (مشترک بین پنل و فروشگاه)
 */

export const ORDER_STATUS_FA: Record<string, string> = {
  PENDING: "در انتظار پرداخت",
  PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل شده",
  CANCELLED: "لغو شده",
  RETURN_REQUESTED: "درخواست مرجوعی",
  RETURNED: "مرجوع شده",
};

export const PAYMENT_STATUS_FA: Record<string, string> = {
  PENDING: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  FAILED: "ناموفق",
  REFUNDED: "بازگردانده شده",
  PARTIALLY_REFUNDED: "بازگردانی جزئی",
  AUTHORIZED: "تأیید موقت",
};
