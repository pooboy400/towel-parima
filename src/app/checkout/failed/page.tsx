import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "پرداخت ناموفق بود",
  robots: { index: false },
};

/**
 * Failed Page — پرداخت ناموفق/لغو شده. سفارش هنوز در پنل «لغو شده» است؛
 * کاربر می‌تواند دوباره خرید را از سبد شروع کند.
 */
export default function CheckoutFailedPage() {
  return (
    <div className="container-brand flex flex-col items-center py-16 lg:py-24">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg border border-line bg-surface px-6 py-12 text-center sm:px-12">
        <span className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="size-9 text-destructive" aria-hidden />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">پرداخت انجام نشد</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            پرداخت با موفقیت انجام نشود یا لغو شده است. هیچ مبلغی از حساب شما کسر
            نشده و کالاها رزرو باقی مانده‌اند. می‌توانید دوباره تلاش کنید.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2.5 sm:flex-row">
          <Button asChild variant="terracotta" className="flex-1">
            <Link href="/cart">بازگشت به سبد خرید</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/shop">مشاهده محصولات</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
