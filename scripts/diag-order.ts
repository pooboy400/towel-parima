/** بررسی وضعیت سفارش/پرداخت/رزرو بعد از E2E */
import { db } from "../src/lib/db";

const order = await db.order.findFirst({
  orderBy: { placedAt: "desc" },
  include: {
    items: true,
    payments: true,
    reservations: true,
  },
});

if (!order) {
  console.log("هیچ سفارشی نیست");
} else {
  console.log({
    code: order.code,
    status: order.status,
    grandTotal: order.grandTotal,
    items: order.items.map((i) => ({ sku: i.skuSnapshot, qty: i.quantity, total: i.total })),
    payments: order.payments.map((p) => ({ status: p.status, amount: p.amount, tx: p.transactionId })),
    reservations: order.reservations.map((r) => ({ status: r.status, qty: r.qty })),
  });
}

const variant = await db.variant.findFirst({
  where: { sku: "PRM-BT-70140-CRM" },
  select: { stock: true, reserved: true },
});
console.log("variant PRM-BT-70140-CRM:", variant);
process.exit(0);
