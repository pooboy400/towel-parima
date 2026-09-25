import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrderByCode } from "@/core/commerce/checkout-service";
import { formatPrice, faDigits } from "@/lib/format";
import { ClearCartOnMount } from "./clear-cart";

export const metadata = {
  title: "سفارش ثبت شد",
  robots: { index: false },
};

/**
 * Success Page — پس از تأیید درگاه. سفارش با کد رهگیری واقعی از DB خوانده
 * می‌شود؛ وضعیت PROCESSING یعنی پرداخت تأیید و موجودی قطعی شده است.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const order = code ? await getOrderByCode(code) : null;

  return (
    <div className="container-brand flex flex-col items-center py-16 lg:py-24">
      <ClearCartOnMount />
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg border border-line bg-surface px-6 py-12 text-center sm:px-12">
        <span className="flex size-16 items-center justify-center rounded-full bg-sage/15">
          <CheckCircle2 className="size-9 text-sage" aria-hidden />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">
            پرداخت موفق — سفارش شما ثبت شد
          </h1>
          <p className="text-sm leading-7 text-muted-foreground">
            از اعتماد شما سپاسگزاریم. جزئیات سفارش برای پیگیری در پایین آمده است.
          </p>
        </div>

        {order ? (
          <div className="flex w-full flex-col gap-3 rounded-md bg-cream p-4 text-[13px]">
            <p className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Package className="size-4" aria-hidden />
                کد پیگیری سفارش
              </span>
              <span dir="ltr" className="font-semibold tracking-wide">
                {faDigits(order.code)}
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-muted-foreground">وضعیت</span>
              <span className="font-medium text-sage">
                {order.status === "PROCESSING" ? "در حال آماده‌سازی" : order.status === "PENDING" ? "در انتظار پرداخت" : order.status}
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-muted-foreground">تعداد اقلام</span>
              <span className="font-medium">
                {faDigits(order.items.reduce((s, i) => s + i.quantity, 0))} عدد
              </span>
            </p>
            <p className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Truck className="size-4" aria-hidden />
                مبلغ پرداخت‌شده
              </span>
              <span className="font-semibold">{formatPrice(order.grandTotal)}</span>
            </p>
          </div>
        ) : (
          <div className="w-full rounded-md bg-cream p-4 text-[13px] text-muted-foreground">
            برای پیگیری، کد سفارش خود را در صفحه «پیگیری سفارش» وارد کنید.
          </div>
        )}

        <div className="flex w-full flex-col gap-2.5 sm:flex-row">
          <Button asChild variant="terracotta" className="flex-1">
            <Link href="/order-tracking">پیگیری سفارش</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/shop">ادامه خرید</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
