import type { Metadata } from "next";
import { headers } from "next/headers";
import { PackageSearch, ShieldCheck } from "lucide-react";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { getOrderByCodeForTracking } from "@/core/commerce/checkout-service";
import { rateLimiter, RATE_RULES, rateKey } from "@/core/rate-limit";
import { extractClientIp } from "@/lib/client-ip";
import { TrackingForm } from "./tracking-form";
import { OrderStatusCard } from "./status-card";

export const metadata: Metadata = {
  title: "پیگیری سفارش",
  robots: { index: false, follow: false },
};

/**
 * Order Tracking — پیگیری واقعی با کد رهگیری (M4).
 * SEC-04 (IDOR F-3/51d): فاکتور دوم الزامی — کد + شمارهٔ موبایلِ سفارش؛
 * rate-limit per-IP روی تلاش پیگیری (rule: orderTracking).
 * پیام «یافت نشد» برای کد غلط و موبایل غلط یکسان است (بدون نشت وجود سفارش).
 */
export default async function OrderTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; phone?: string }>;
}) {
  const { code, phone } = await searchParams;

  // rate-limit فقط برای تلاش پیگیری (کد ارسال‌شده) — بازدید سادهٔ صفحه شمارش نمی‌شود
  let rateLimited = false;
  if (code) {
    const ip = extractClientIp(await headers()) ?? "unknown";
    const rl = await rateLimiter.hit(rateKey("order-tracking", ip), RATE_RULES.orderTracking);
    rateLimited = !rl.ok;
  }

  const order =
    code && phone && !rateLimited ? await getOrderByCodeForTracking(code, phone) : null;
  const missingPhone = Boolean(code) && !phone && !rateLimited;

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
            کد رهگیری و شمارهٔ موبایلِ سفارش خود را وارد کنید — این اطلاعات در
            صفحهٔ پرداخت موفق و پیامک سفارش آمده است.
          </p>
        </div>

        <div className="mt-8 rounded-lg border border-line bg-surface p-6 sm:p-8">
          <TrackingForm initialCode={code ?? ""} initialPhone={phone ?? ""} />
        </div>

        {rateLimited && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-center text-[13px] text-destructive"
          >
            تلاش‌های پیگیری زیاد بوده — لطفاً چند دقیقه بعد دوباره امتحان کنید.
          </p>
        )}

        {missingPhone && (
          <p
            role="status"
            className="mt-4 flex items-center justify-center gap-2 rounded-md border border-line bg-secondary/40 p-4 text-center text-[13px] text-muted-foreground"
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            برای حفظ حریم خصوصی خریداران، لطفاً شمارهٔ موبایلِ ثبت‌شده روی سفارش را هم وارد کنید.
          </p>
        )}

        {code && phone && !rateLimited && !order && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-center text-[13px] text-destructive"
          >
            سفارشی با این کد و شمارهٔ موبایل یافت نشد — اطلاعات را دوباره بررسی کنید.
          </p>
        )}

        {order && <OrderStatusCard order={order} />}
      </div>
    </div>
  );
}
