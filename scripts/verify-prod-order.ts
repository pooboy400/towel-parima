// verify-prod-order.ts — راستی‌آزمایی وضعیت سفارش تستی در production run
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const code = process.argv[2] ?? "0174469698";

const order = await db.order.findFirst({
  where: { code },
  select: {
    code: true, status: true, grandTotal: true, phone: true, placedAt: true,
    payments: { select: { status: true, amount: true, authority: true } },
    reservations: {
      select: { status: true, qty: true, releasedAt: true, variant: { select: { sku: true, stock: true, reserved: true, product: { select: { slug: true } } } } },
    },
  },
});

if (!order) { console.log("ORDER NOT FOUND:", code); process.exit(1); }

console.log("ORDER:", order.code, "| status:", order.status, "| total:", order.grandTotal, "| phone:", order.phone);
for (const p of order.payments) console.log("PAYMENT:", p.status, p.amount, "authority:", (p.authority ?? "").slice(0, 20));
for (const r of order.reservations) {
  console.log("RESERVATION:", r.status, "qty:", r.qty, "sku:", r.variant.sku, "product:", r.variant.product.slug);
  console.log("  VARIANT INVENTORY: stock:", r.variant.stock, "reserved:", r.variant.reserved, "(reserved باید 0 باشد پس از تبدیل موفق)");
}

await db.$disconnect();
