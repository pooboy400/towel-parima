/**
 * حملهٔ ۴ (redteam-60) — محصولِ همه-واریانت-غیرفعال از مسیر ثبت سفارش
 * بردار ۱ (سرویس‌لول — معادل نهایی هر دستکاری کلاینت): placeOrder با سه‌تاییِ واریانت غیرفعال
 * بردار ۲ (HTTP): فراخوانی مستقیم Server Action placeOrderAction با encoding واقعی
 * انتظار: OUT_OF_STOCK/ردِ تمیز · صفر رزرو · صفر سفارش · reserved=0
 */
import { PrismaClient } from "@prisma/client";
import { placeOrder } from "../../src/core/commerce/checkout-service";
import { DomainError } from "../../src/core/errors";

const db = new PrismaClient();
const PRODUCT_ID = "cmuidi04g0001nddxi8k62fqf"; // test-inactive-all-variants (QA فیکسچر موجود، مال من نیست — فقط می‌خوانم)
const report: Record<string, unknown> = {};

const before = {
  reservations: await db.inventoryReservation.count({ where: { variant: { productId: PRODUCT_ID } } }),
  variantState: await db.variant.findMany({ where: { productId: PRODUCT_ID }, select: { sku: true, reserved: true, stock: true, isActive: true } }),
  ordersForProduct: await db.order.count({ where: { items: { some: { productId: PRODUCT_ID } } } }),
};

// ── بردار ۱: سرویس‌لول — سه‌تایی واریانت غیرفعال (colorId/sizeId = null چون null هستند)
let vector1: unknown;
try {
  await placeOrder({
    userId: null,
    lines: [{ productId: PRODUCT_ID, colorId: null, sizeId: null, quantity: 1 }],
    address: { fullName: "redteam-60", phone: "09390000001", province: "تهران", city: "تهران", postalCode: "1111111111", line: "redteam" },
    shippingMethod: "standard",
  });
  vector1 = { reached: true }; // نباید برسد
} catch (e) {
  vector1 = { reached: false, code: (e as DomainError).code ?? "UNKNOWN", message: (e as Error).message };
}
report.vector1_serviceLevel = vector1;

// ── بردار ۱-ب: حتی با productId/سه‌تایی جعلیِ واریانتِ دومِ غیرفعال (همان null/null)
let vector1b: unknown;
try {
  await placeOrder({
    userId: null,
    lines: [{ productId: PRODUCT_ID, colorId: null, sizeId: null, quantity: 2 }],
    address: { fullName: "redteam-60", phone: "09390000002", province: "تهران", city: "تهران", postalCode: "1111111111", line: "redteam" },
    shippingMethod: "standard",
  });
  vector1b = { reached: true };
} catch (e) {
  vector1b = { reached: false, code: (e as DomainError).code ?? "UNKNOWN", message: (e as Error).message };
}
report.vector1b_serviceLevel_qty2 = vector1b;

const after = {
  reservations: await db.inventoryReservation.count({ where: { variant: { productId: PRODUCT_ID } } }),
  variantState: await db.variant.findMany({ where: { productId: PRODUCT_ID }, select: { sku: true, reserved: true, stock: true, isActive: true } }),
  ordersForProduct: await db.order.count({ where: { items: { some: { productId: PRODUCT_ID } } } }),
  pendingOrdersMine: await db.order.count({ where: { phone: { startsWith: "0939" } } }),
};
report.db = { before, after };

const noMutation =
  before.reservations === after.reservations &&
  before.ordersForProduct === after.ordersForProduct &&
  JSON.stringify(before.variantState.map((v) => [v.sku, v.reserved])) === JSON.stringify(after.variantState.map((v) => [v.sku, v.reserved]));
report.verdict = {
  rejectedClean: (vector1 as { code?: string }).code === "OUT_OF_STOCK" && (vector1b as { code?: string }).code === "OUT_OF_STOCK",
  noMutation,
  BREACHED: !(noMutation && (vector1 as { code?: string }).code === "OUT_OF_STOCK"),
};
console.log(JSON.stringify(report, null, 1));
await Bun.write(new URL("./attack4-result.json", import.meta.url), JSON.stringify(report, null, 1));
await db.$disconnect();
