// پاکسازی رزرو/سفارش نیمه‌کارهٔ تست برچسب — مسیر سرویس لغو + اصلاح فانتوم reserved
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const VARIANT_ID = "cmufs3w4d0015lk5nj0qc2sdj";

async function main() {
  const { cancelOrder } = await import("../src/core/commerce/order-service");
  const order = await db.order.findFirst({ where: { phone: "09121117777" } });
  if (order) {
    await cancelOrder(order.id, { reason: "پاکسازی تست برچسب خودکار", actorId: null });
    console.log("سفارش تست لغو شد:", order.code);
  } else {
    console.log("سفارش تستی نبود");
  }

  const before = await db.variant.findUnique({
    where: { id: VARIANT_ID },
    select: { stock: true, reserved: true },
  });
  console.log("قبل اصلاح فانتوم:", before);
  await db.variant.update({ where: { id: VARIANT_ID }, data: { reserved: 0 } });
  const after = await db.variant.findUnique({
    where: { id: VARIANT_ID },
    select: { stock: true, reserved: true },
  });
  console.log("بعد اصلاح:", after);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
