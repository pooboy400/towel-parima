import type { Metadata } from "next";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { getCustomerContext } from "@/core/auth/customer-session";
import { listUserOrders } from "@/core/commerce/checkout-service";
import { listAddresses } from "@/core/commerce/address-service";
import { LoginForm } from "./login-forms";
import {
  OrdersPanel,
  AddressesPanel,
  ProfilePanel,
  type AccountOrder,
} from "./account-panels";
import { ORDER_STATUS_FA } from "@/lib/order-status";

export const metadata: Metadata = {
  title: "حساب کاربری",
  robots: { index: false, follow: false },
};

/**
 * Account Page — مهمان: فرم ورود دوگانه (OTP/رمز).
 * مشتری: سه تب — سفارش‌های من، دفترچه آدرس، اطلاعات حساب.
 */
export default async function AccountPage() {
  const customer = await getCustomerContext();

  if (!customer) {
    return (
      <div className="container-brand py-8 lg:py-10">
        <Breadcrumb
          items={[{ label: "خانه", href: "/" }, { label: "حساب کاربری" }]}
        />
        <div className="mt-8 flex justify-center lg:mt-10">
          <LoginForm />
        </div>
      </div>
    );
  }

  // Promise.all — هر دو خواندنی سبک
  const [orders, addresses] = await Promise.all([
    listUserOrders(customer.userId, 20),
    listAddresses(customer.userId),
  ]);

  const accountOrders: AccountOrder[] = orders.map((o) => ({
    id: o.id,
    code: o.code,
    status: o.status,
    statusFa: ORDER_STATUS_FA[o.status] ?? o.status,
    grandTotal: o.grandTotal,
    itemCount: o.items.length,
    placedAt: o.placedAt.toISOString(),
  }));

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb
        items={[{ label: "خانه", href: "/" }, { label: "حساب کاربری" }]}
      />

      <h1 className="mt-6 text-2xl font-bold">حساب کاربری</h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        سفارش‌ها، آدرس‌های ذخیره‌شده و اطلاعات حساب شما
      </p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="orders-heading">
            <h2 id="orders-heading" className="mb-3 text-[15px] font-semibold">
              سفارش‌های من
            </h2>
            <OrdersPanel orders={accountOrders} />
          </section>

          <section aria-labelledby="addresses-heading">
            <h2 id="addresses-heading" className="mb-3 text-[15px] font-semibold">
              دفترچه آدرس‌ها
            </h2>
            <AddressesPanel
              addresses={addresses.map((a) => ({
                id: a.id,
                fullName: a.fullName,
                phone: a.phone,
                province: a.province,
                city: a.city,
                postalCode: a.postalCode,
                line: a.line,
                isDefault: a.isDefault,
              }))}
            />
          </section>
        </div>

        <aside>
          <h2 className="mb-3 text-[15px] font-semibold">اطلاعات حساب</h2>
          <ProfilePanel
            customer={{
              name: customer.name,
              phone: customer.phone,
              passwordSet: customer.passwordSet,
            }}
          />
        </aside>
      </div>
    </div>
  );
}
