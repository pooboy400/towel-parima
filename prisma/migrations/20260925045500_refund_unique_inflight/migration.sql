-- MEDIUM-2 (گزارش 47-a): حداکثر یک Refund PROCESSING در جریان برای هر سفارش
-- پشتیبان DB-level برای گارد اتمیک requestRefund (قفل FOR UPDATE + re-check).
-- ایندکس جزئی — خاتمه‌یافتگان (SUCCEEDED/FAILED) محدود نمی‌شوند.
CREATE UNIQUE INDEX "Refund_orderId_inflight_key"
  ON "Refund"("orderId")
  WHERE "status" = 'PROCESSING';
