import { getStoreSettingsSafe } from "@/services/settings-service";
import { CartView } from "./cart-view";

/**
 * Cart Page (Server) — نرخ‌های ارسال را از Settings دیتابیس می‌خواند
 * و به ویو کلاینت می‌دهد (سبد مهمان در localStorage می‌ماند؛ فقط نرخ‌ها سروری است).
 */
export default async function CartPage() {
  const { config } = await getStoreSettingsSafe();

  return (
    <CartView
      shippingRates={{
        freeShippingThreshold: config.freeShippingThreshold,
        standardShippingCost: config.standardShippingCost,
        expressShippingCost: config.expressShippingCost,
      }}
    />
  );
}
