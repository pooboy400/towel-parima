/**
 * حملهٔ ۳ (redteam-60) — فیکسچر سفارش PENDING خودم برای تست گذار
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const o = await db.order.create({
  data: {
    code: `H6${Math.random().toString(36).slice(2, 10)}`.slice(0, 10),
    phone: "09380000001",
    status: "PENDING",
    subtotal: 100_000,
    discountTotal: 0,
    shippingTotal: 0,
    taxTotal: 0,
    grandTotal: 100_000,
    currency: "IRT",
    shippingAddress: { fullName: "redteam-60 t3", phone: "09380000001" },
    placedAt: new Date(),
  },
  select: { id: true, code: true, status: true },
});
console.log(JSON.stringify(o));
await db.$disconnect();
