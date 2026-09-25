/**
 * تست انقضای رزرو (M5) — چرخهٔ کامل:
 * ساخت رزرو مصنوعی منقضی → expireStaleReservations → تأیید آزاد شدن موجودی → پاک‌سازی
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const RESERVATION_TTL_MS = 20 * 60 * 1000;

async function main() {
  const variant = await db.variant.findFirst({
    where: { isActive: true, deletedAt: null, product: { deletedAt: null, status: "ACTIVE" } },
    select: { id: true, stock: true, reserved: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!variant) throw new Error("no variant");

  console.log(`قبل: variant=${variant.id} stock=${variant.stock} reserved=${variant.reserved}`);

  // رزرو مصنوعی منقضی (۱ دقیقه پیش)
  const res = await db.inventoryReservation.create({
    data: {
      variantId: variant.id,
      qty: 2,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  await db.variant.update({ where: { id: variant.id }, data: { reserved: { increment: 2 } } });
  console.log(`رزرو مصنوعی منقضی ساخته شد: ${res.id} (qty=2)`);

  // worker انقضا — همان تابعی که instrumentation هر ۵ دقیقه صدا می‌زند
  const { expireStaleReservations } = await import("../src/core/commerce/inventory-service");
  const expired = await expireStaleReservations();
  console.log(`worker انقضا: ${expired} رزرو منقضی شد`);

  const after = await db.variant.findUnique({
    where: { id: variant.id },
    select: { stock: true, reserved: true },
  });
  console.log(`بعد: stock=${after?.stock} reserved=${after?.reserved}`);
  console.log(
    after?.reserved === variant.reserved
      ? "✅ PASS — موجودی رزرو آزاد شد (reserved برگشت) و stock دست‌نخورده ماند"
      : "❌ FAIL — free نشد!",
  );

  // پاک‌سازی رکورد تست
  await db.inventoryReservation.delete({ where: { id: res.id } });
  console.log("رکورد تست پاک شد");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
