import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { getOrderByCode } from "@/core/commerce/checkout-service";
import { TrackingForm } from "./tracking-form";
import { OrderStatusCard } from "./status-card";

export const metadata: Metadata = {
  title: "پیگیری سفارش",
  robots: { index: false, follow: false },
};

/**
 * Order Tracking — پیگیری واقعی با کد رهگیری (M4).
 * کد از searchParams یا فرم؛ نتیجه: تایم‌لاین وضعیت + اقلام.
 */
export default async function OrderTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const order = code ? await getOrderByCode(code) : null;

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb
        items={[{ label: "خانه", href: "/" }, { label: "پیگیری سفارش" }]}
      />

      <div className="mx-auto mt-8 max-w-xl lg:mt-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <PackageSearch
              className="size-6 text-terracotta-deep"
              aria-hidden
            />
          </span>
          <h1 className="text-2xl font-bold sm:text-3xl">پیگیری سفارش</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            کد رهگیری سفارش خود را وارد کنید — این کد در صفحه پرداخت موفق و
            پیامک سفارش آمده است.
          </p>
        </div>

        <div className="mt-8 rounded-lg border border-line bg-surface p-6 sm:p-8">
          <TrackingForm initialCode={code ?? ""} />
        </div>

        {code && !order && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-center text-[13px] text-destructive"
          >
            سفارشی با کد «{code}» یافت نشد — کد را دوباره بررسی کنید.
          </p>
        )}

        {order && <OrderStatusCard order={order} />}
      </div>
    </div>
  );
}
