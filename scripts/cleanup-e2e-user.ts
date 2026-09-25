/** پاکسازی داده‌های تست مرورگر (کاربر E2E) */
import { db } from "../src/lib/db";

const PHONES = ["09357770022", "09357770011"];

const users = await db.user.findMany({
  where: { phone: { in: PHONES } },
  select: { id: true, phone: true },
});

for (const user of users) {
  await db.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
  await db.cart.deleteMany({ where: { userId: user.id } });
  await db.address.deleteMany({ where: { userId: user.id } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
  console.log(`پاک شد: ${user.phone}`);
}

await db.otpCode.deleteMany({ where: { phone: { in: PHONES } } });
await db.outboxEvent.deleteMany({ where: { type: "CustomerWelcome" } });
console.log("پاکسازی کامل ✓");
process.exit(0);
