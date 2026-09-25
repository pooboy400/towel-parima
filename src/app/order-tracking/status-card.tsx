import Image from "next/image";
import { CheckCircle2, Circle, Package, Truck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, faDigits } from "@/lib/format";
import { ORDER_STATUS_FA, PAYMENT_STATUS_FA } from "@/lib/order-status";
import type { Order, OrderItem, Payment, Shipment } from "@prisma/client";

/**
 * Status Card — تایم‌لاین وضعیت سفارش + اقلام snapshot (M4).
 * تاریخچه immutable — اقلام از snapshot رکورد خوانده می‌شوند (§14).
 */

/** مراحل نمایشی — سفارش لغوشده مسیر جدا دارد */
const TIMELINE = [
  { key: "PROCESSING", label: "آماده‌سازی" },
  { key: "SHIPPED", label: "ارسال" },
  { key: "DELIVERED", label: "تحویل" },
] as const;

export function OrderStatusCard({
  order,
}: {
  order: Order & { items: OrderItem[]; payments: Payment[]; shipments: Shipment[] };
}) {
  const cancelled = order.status === "CANCELLED";
  const currentIndex = TIMELINE.findIndex((t) => t.key === order.status);
  const returned = order.status === "RETURNED" || order.status === "RETURN_REQUESTED";
  const payment = order.payments[0];
  const shipment = order.shipments[0];

  return (
    <div className="mt-6 flex flex-col gap-5 rounded-lg border border-line bg-surface p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">سفارش</p>
          <p className="text-lg font-bold" dir="ltr">{faDigits(order.code)}</p>
        </div>
        <div className="text-end">
          <p className="text-[13px] text-muted-foreground">مبلغ کل</p>
          <p className="text-[15px] font-bold">{formatPrice(order.grandTotal)}</p>
        </div>
      </header>

      {/* تایم‌لاین */}
      {cancelled ? (
        <p className="flex items-center gap-2 rounded-md bg-destructive/5 p-3 text-[13px] text-destructive">
          <XCircle className="size-4" aria-hidden />
          این سفارش لغو شده است.
        </p>
      ) : (
        <ol className="flex items-center justify-between" aria-label="وضعیت سفارش">
          {TIMELINE.map((step, i) => {
            const done = currentIndex > i || returned;
            const current = currentIndex === i && !returned;
            return (
              <li key={step.key} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-[12px]",
                    done && "text-sage",
                    current && "font-semibold text-terracotta-deep",
                    !done && !current && "text-muted-foreground",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="size-4" aria-hidden />
                  ) : (
                    <Circle className={cn("size-4", current && "fill-terracotta text-terracotta")} aria-hidden />
                  )}
                  {step.label}
                </span>
                {i < TIMELINE.length - 1 && (
                  <span className={cn("h-px flex-1", done ? "bg-sage" : "bg-line")} aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* پرداخت و ارسال */}
      <div className="grid gap-3 text-[13px] leading-6 sm:grid-cols-2">
        <div className="rounded-md bg-cream p-3">
          <p className="flex items-center gap-1.5 font-semibold">
            <Package className="size-4" aria-hidden />
            پرداخت
          </p>
          <p className="text-muted-foreground">
            {payment ? PAYMENT_STATUS_FA[payment.status] ?? payment.status : "بدون تلاش پرداخت"}
          </p>
        </div>
        <div className="rounded-md bg-cream p-3">
          <p className="flex items-center gap-1.5 font-semibold">
            <Truck className="size-4" aria-hidden />
            ارسال
          </p>
          <p className="text-muted-foreground">
            {shipment?.trackingCode
              ? `کد رهگیری پستی: ${faDigits(shipment.trackingCode)}`
              : "پس از ارسال، کد رهگیری اینجا نمایش داده می‌شود."}
          </p>
        </div>
      </div>

      {/* اقلام */}
      <ul className="flex flex-col divide-y divide-line">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            {item.imageUrlSnapshot && (
              <span className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-secondary/40">
                <Image src={item.imageUrlSnapshot} alt="" fill sizes="48px" className="object-cover" />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col text-[13px]">
              <span className="font-medium">{item.productNameSnapshot}</span>
              {item.variantNameSnapshot && (
                <span className="text-xs text-muted-foreground">{item.variantNameSnapshot}</span>
              )}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {faDigits(item.quantity)} ×
            </span>
            <span className="text-[13px] font-medium">{formatPrice(item.total, false)}</span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-muted-foreground">
        وضعیت: {ORDER_STATUS_FA[order.status] ?? order.status} · ثبت شده در{" "}
        {faDigits(order.placedAt.toLocaleDateString("fa-IR"))}
      </p>
    </div>
  );
}
