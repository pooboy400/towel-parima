import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { OrdersManager } from "./orders-manager";
import { ORDER_STATUS_FA } from "@/lib/order-status";

export const dynamic = "force-dynamic";

/**
 * Admin Orders — لیست سفارش‌ها با فیلتر وضعیت + گذار وضعیت + فاکتور.
 * مبالغ snapshot سفارش هرگز از قیمت فعلی محصول محاسبه نمی‌شوند (§14).
 */
export default async function AdminOrdersPage() {
  const orders = await db.order.findMany({
    orderBy: { placedAt: "desc" },
    take: 100,
    include: {
      items: { select: { id: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      refunds: { where: { status: "SUCCEEDED" }, select: { amount: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="سفارش‌ها"
        description="مدیریت وضعیت سفارش‌ها، ثبت کد رهگیری، بازگشت وجه و چاپ فاکتور"
      />
      <OrdersManager
        orders={orders.map((o) => {
          const paidTotal = o.payments
            .filter((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED")
            .reduce((s, p) => s + p.amount, 0);
          const refundedTotal = o.refunds.reduce((s, r) => s + r.amount, 0);
          return {
            id: o.id,
            code: o.code,
            status: o.status,
            statusFa: ORDER_STATUS_FA[o.status] ?? o.status,
            grandTotal: o.grandTotal,
            subtotal: o.subtotal,
            discountTotal: o.discountTotal,
            shippingTotal: o.shippingTotal,
            phone: o.phone,
            itemCount: o.items.reduce((s, i) => s + 1, 0),
            placedAt: o.placedAt.toISOString(),
            paymentStatus: o.payments[0]?.status ?? null,
            paidTotal,
            refundedTotal,
          };
        })}
      />
    </div>
  );
}
