import type { Metadata } from "next";
import { getCustomerContext } from "@/core/auth/customer-session";
import { listAddresses } from "@/core/commerce/address-service";
import { getStoreSettingsSafe } from "@/services/settings-service";
import { CheckoutClient, type CheckoutSavedAddress } from "./checkout-client";

export const metadata: Metadata = {
  title: "تکمیل خرید",
  robots: { index: false },
};

/**
 * Checkout Page — سرور. آدرس‌های ذخیره‌شده مشتری برای انتخاب سریع به فرم
 * داده می‌شود (M4). ثبت سفارش با Server Action تراکنشی (§10.1).
 * نرخ‌های ارسال و زمان‌بندی از Settings دیتابیس خوانده می‌شود — هم‌جهت با
 * محاسبهٔ سروری checkout-service؛ هیچ عدد ارسالی ثابت در کلاینت نیست.
 */
export default async function CheckoutPage() {
  const customer = await getCustomerContext();
  const { config, shipping } = await getStoreSettingsSafe();

  let savedAddresses: CheckoutSavedAddress[] = [];
  if (customer) {
    const rows = await listAddresses(customer.userId).catch(() => []);
    savedAddresses = rows.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      phone: a.phone,
      province: a.province,
      city: a.city,
      postalCode: a.postalCode,
      line: a.line,
      isDefault: a.isDefault,
    }));
  }

  return (
    <CheckoutClient
      savedAddresses={savedAddresses}
      shippingRates={{
        freeShippingThreshold: config.freeShippingThreshold,
        standardShippingCost: config.standardShippingCost,
        expressShippingCost: config.expressShippingCost,
      }}
      shippingDays={shipping}
    />
  );
}
