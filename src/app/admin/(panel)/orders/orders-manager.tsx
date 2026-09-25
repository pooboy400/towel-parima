"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Printer, Truck, XCircle, CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPrice, faDigits, toLatinDigits } from "@/lib/format";
import {
  transitionOrderAction,
  shipOrderAction,
  refundOrderAction,
} from "./actions";

export interface AdminOrderRow {
  id: string;
  code: string;
  status: string;
  statusFa: string;
  grandTotal: number;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  phone: string;
  itemCount: number;
  placedAt: string;
  paymentStatus: string | null;
  /** مجموع پرداخت‌های موفق قابل استرداد */
  paidTotal: number;
  /** مجموع استردادهای موفق تا امروز */
  refundedTotal: number;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-sand/30 text-sand-deep",
  PROCESSING: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-sage/20 text-sage-deep",
  CANCELLED: "bg-destructive/10 text-destructive",
  RETURN_REQUESTED: "bg-amber-100 text-amber-800",
  RETURNED: "bg-muted text-muted-foreground",
};

const FILTERS = [
  { key: "ALL", label: "همه" },
  { key: "PENDING", label: "در انتظار پرداخت" },
  { key: "PROCESSING", label: "آماده‌سازی" },
  { key: "SHIPPED", label: "ارسال شده" },
  { key: "DELIVERED", label: "تحویل شده" },
  { key: "CANCELLED", label: "لغو شده" },
] as const;

/**
 * OrdersManager — جدول سفارش‌ها + جزئیات در دیالوگ: گذار وضعیت، ثبت ارسال
 * با کد رهگیری، لینک فاکتور چاپی.
 */
export function OrdersManager({ orders }: { orders: AdminOrderRow[] }) {
  const [filter, setFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    // جستجو با ارقام فارسی هم مچ می‌شود — جدول با faDigits نمایش می‌دهد (47-f MEDIUM)
    const q = toLatinDigits(query.trim().toLowerCase());
    return orders.filter((o) => {
      if (filter !== "ALL" && o.status !== filter) return false;
      if (q && !o.code.includes(q) && !o.phone.includes(q)) return false;
      return true;
    });
  }, [orders, filter, query]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: orders.length };
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [orders]);

  return (
    <div className="flex flex-col gap-4">
      {/* فیلترها */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
              filter === f.key
                ? "bg-deep text-cream font-medium"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
            )}
          >
            {f.label}
            <span className="ms-1.5 opacity-70">{faDigits(counts[f.key] ?? 0)}</span>
          </button>
        ))}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="کد سفارش یا موبایل…"
          className="ms-auto w-56"
          dir="ltr"
        />
      </div>

      {/* جدول — اسکرول افقی در موبایل (مطابق جدول محصولات) + ستون‌های کم‌اهمیت مخفی در sm */}
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-cream/60 text-muted-foreground">
              <th className="px-4 py-3 text-start font-medium">کد</th>
              <th className="hidden px-4 py-3 text-start font-medium md:table-cell">تاریخ</th>
              <th className="px-4 py-3 text-start font-medium">موبایل</th>
              <th className="hidden px-4 py-3 text-start font-medium sm:table-cell">اقلام</th>
              <th className="px-4 py-3 text-start font-medium">مبلغ</th>
              <th className="hidden px-4 py-3 text-start font-medium md:table-cell">پرداخت</th>
              <th className="px-4 py-3 text-start font-medium">وضعیت</th>
              <th className="px-4 py-3 text-start font-medium">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 font-mono" dir="ltr">{faDigits(o.code)}</td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {faDigits(new Date(o.placedAt).toLocaleDateString("fa-IR"))}
                </td>
                <td className="px-4 py-3" dir="ltr">{faDigits(o.phone)}</td>
                <td className="hidden px-4 py-3 sm:table-cell">{faDigits(o.itemCount)}</td>
                <td className="px-4 py-3 font-medium">{formatPrice(o.grandTotal, false)}</td>
                <td className="hidden px-4 py-3 md:table-cell">
                  {o.paymentStatus === "PAID" ? (
                    <span className="text-sage">پرداخت شده</span>
                  ) : o.paymentStatus === "FAILED" ? (
                    <span className="text-destructive">ناموفق</span>
                  ) : o.paymentStatus === "PENDING" ? (
                    <span className="text-muted-foreground">در انتظار</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs", STATUS_STYLES[o.status] ?? "bg-muted")}>
                    {o.statusFa}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <OrderActions order={o} pending={pending} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  سفارشی با این فیلتر یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** دیالوگ جزئیات + دکمه‌های گذار وضعیت */
function OrderActions({ order, pending }: { order: AdminOrderRow; pending: boolean }) {
  const [shipOpen, setShipOpen] = useState(false);
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [isPending, startTransition] = useTransition();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, onSuccess?: () => void) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success("انجام شد");
        onSuccess?.();
      } else {
        toast.error(res.error?.message ?? "عملیات ناموفق بود");
      }
    });
  };

  const canShip = order.status === "PROCESSING";
  const canDeliver = order.status === "SHIPPED";
  const canCancel = order.status === "PENDING" || order.status === "PROCESSING";
  const canReturn = order.status === "RETURN_REQUESTED";

  const refundableRemaining = Math.max(0, order.paidTotal - order.refundedTotal);
  const canRefund =
    refundableRemaining > 0 &&
    order.status !== "CANCELLED" &&
    (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED");

  const submitRefund = () => {
    const amount = Number(refundAmount.replace(/[^\d]/g, ""));
    if (!amount || amount <= 0) {
      toast.error("مبلغ بازگشت وجه را وارد کنید");
      return;
    }
    if (amount > refundableRemaining) {
      toast.error(`سقف بازگشت وجه ${formatPrice(refundableRemaining, false)} تومان است`);
      return;
    }
    if (refundReason.trim().length < 2) {
      toast.error("دلیل بازگشت وجه را بنویسید");
      return;
    }
    run(
      () => refundOrderAction({ orderId: order.id, amountIrt: amount, reason: refundReason.trim() }),
      () => {
        setRefundOpen(false);
        setRefundAmount("");
        setRefundReason("");
      },
    );
  };

  return (
    <div className="flex items-center gap-1">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`جزئیات سفارش ${order.code}`}>
            <Eye className="size-4" aria-hidden />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span dir="ltr">سفارش {faDigits(order.code)}</span>
              <span className={cn("rounded-full px-2.5 py-1 text-xs", STATUS_STYLES[order.status] ?? "bg-muted")}>
                {order.statusFa}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 text-[13px]">
            <div className="flex flex-col gap-1.5 rounded-md bg-cream p-3">
              <Row label="مبلغ کالاها" value={formatPrice(order.subtotal, false)} />
              {order.discountTotal > 0 && (
                <Row label="تخفیف" value={`−${formatPrice(order.discountTotal, false)}`} />
              )}
              <Row label="ارسال" value={order.shippingTotal === 0 ? "رایگان" : formatPrice(order.shippingTotal, false)} />
              <Row label="مبلغ کل" value={formatPrice(order.grandTotal, false)} strong />
              {order.refundedTotal > 0 && (
                <Row
                  label="بازگشت‌شده"
                  value={`−${formatPrice(order.refundedTotal, false)} تومان`}
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              {canShip && (
                <div className="flex flex-col gap-2 rounded-md border border-line p-3">
                  <Label className="text-[13px]">ثبت ارسال</Label>
                  <Input
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="پست پیشتاز"
                  />
                  <Input
                    dir="ltr"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="کد رهگیری ۲۴ رقمی"
                  />
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      run(() =>
                        shipOrderAction({
                          orderId: order.id,
                          carrier,
                          trackingCode: tracking || null,
                        }),
                      )
                    }
                  >
                    <Truck className="me-1.5 size-4" aria-hidden />
                    ثبت و ارسال
                  </Button>
                </div>
              )}

              {canRefund && (
                <div className="flex flex-col gap-2 rounded-md border border-line p-3">
                  <button
                    type="button"
                    className="flex items-center justify-between text-[13px] font-medium"
                    onClick={() => setRefundOpen((v) => !v)}
                    aria-expanded={refundOpen}
                  >
                    <span className="flex items-center gap-1.5">
                      <Undo2 className="size-4" aria-hidden />
                      بازگشت وجه
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      سقف: {formatPrice(refundableRemaining, false)} تومان
                    </span>
                  </button>
                  {refundOpen && (
                    <div className="flex flex-col gap-2 pt-1">
                      <Input
                        dir="ltr"
                        inputMode="numeric"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder={String(refundableRemaining)}
                        aria-label="مبلغ بازگشت وجه (تومان)"
                      />
                      <Input
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="دلیل: مثلاً مرجوعی مشتری"
                        aria-label="دلیل بازگشت وجه"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={isPending || pending}
                        onClick={submitRefund}
                      >
                        <Undo2 className="me-1.5 size-4" aria-hidden />
                        ثبت بازگشت وجه
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {canDeliver && (
                <Button
                  size="sm"
                  variant="terracotta"
                  disabled={isPending || pending}
                  onClick={() => run(() => transitionOrderAction({ orderId: order.id, to: "DELIVERED" }))}
                >
                  <CheckCircle2 className="me-1.5 size-4" aria-hidden />
                  تأیید تحویل
                </Button>
              )}

              {canReturn && (
                <Button
                  size="sm"
                  variant="terracotta"
                  disabled={isPending || pending}
                  onClick={() => run(() => transitionOrderAction({ orderId: order.id, to: "RETURNED" }))}
                >
                  تأیید مرجوعی و برگرداندن موجودی
                </Button>
              )}

              {canCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={isPending || pending}
                  onClick={() => {
                    if (confirm("این سفارش لغو شود؟ رزرو موجودی آزاد و پرداخت بازگردانده می‌شود.")) {
                      run(() => transitionOrderAction({ orderId: order.id, to: "CANCELLED" }));
                    }
                  }}
                >
                  <XCircle className="me-1.5 size-4" aria-hidden />
                  لغو سفارش
                </Button>
              )}
            </div>

            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/orders/${order.id}/invoice`} target="_blank">
                <Printer className="me-1.5 size-4" aria-hidden />
                فاکتور چاپی
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-bold" : "font-medium"}>{value}</span>
    </p>
  );
}
