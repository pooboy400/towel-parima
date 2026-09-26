/**
 * Cleanup کامل redteam-60 — فقط دیتای خودم با مارکرهای اختصاصی
 * مارکرها: سفارش‌ها phone 0931..0939 (پیشوندهای من) + code H6% ·
 *          کوپن‌ها code H60A% · کاربران phone 0923% (۳ ساعت اخیر) ·
 *          محصول slug h60p*-prod · سفارش‌های مستقیم attack2/3 (id)
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const since = new Date(Date.now() - 3 * 60 * 60 * 1000);

const myPhones = ["0931", "0932", "0933", "0934", "0935", "0936", "0937", "0938", "0939"];
const directOrderIds = ["cmuidv5k60003ndh1lv8nqwjj", "cmuie4mep0000ndr42f1jachp"];

const phoneOrders = await db.order.findMany({
  where: { OR: myPhones.map((p) => ({ phone: { startsWith: p } })) },
  select: { id: true, phone: true, code: true },
});
const orderIds = [...new Set([...phoneOrders.map((o) => o.id), ...directOrderIds])];
console.log("orders to delete:", orderIds.length, JSON.stringify(phoneOrders.map((o) => [o.code, o.phone])));

const myCoupons = await db.coupon.findMany({ where: { code: { startsWith: "H60A" } }, select: { id: true, code: true } });
const myProducts = await db.product.findMany({ where: { slug: { endsWith: "-prod", startsWith: "h60p" } }, select: { id: true, slug: true } });
const myProductIds = myProducts.map((p) => p.id);
const myVariants = myProductIds.length
  ? await db.variant.findMany({ where: { productId: { in: myProductIds } }, select: { id: true } })
  : [];
const myUserIds = (await db.user.findMany({ where: { phone: { startsWith: "0923", }, createdAt: { gte: since } }, select: { id: true } })).map((u) => u.id);

// ۱. رخدادها و پیامک‌های من
for (const oid of orderIds) {
  await db.outboxEvent.deleteMany({ where: { payload: { path: ["orderId"], equals: oid } } });
}
await db.smsLog.deleteMany({ where: { OR: [...myPhones.map((p) => ({ to: { startsWith: p } })), ...orderIds.map((o) => ({ orderId: o }))] } });

// ۲. کوپن‌ها و ردیف‌های مصرف — قبل از سفارش‌ها (FK: CouponRedemption_orderId)
await db.couponRedemption.deleteMany({
  where: { OR: [{ couponId: { in: myCoupons.map((c) => c.id) } }, { orderId: { in: orderIds } }, { userId: { in: myUserIds } }] },
});

// ۳. وابسته‌های سفارش
await db.refund.deleteMany({ where: { orderId: { in: orderIds } } });
await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
await db.inventoryReservation.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { variantId: { in: myVariants.map((v) => v.id) } }] } });
await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
await db.order.deleteMany({ where: { id: { in: orderIds } } });

// ۴. خود کوپن‌ها
await db.coupon.deleteMany({ where: { id: { in: myCoupons.map((c) => c.id) } } });

// ۴. محصول تستی خودم (واریانت‌ها Cascade) — فیکسچر موجود test-inactive-all-variants دست نمی‌خورد
if (myProductIds.length) await db.product.deleteMany({ where: { id: { in: myProductIds } } });

// ۵. کاربران من
await db.user.deleteMany({ where: { id: { in: myUserIds } } });

// ── تأیید صفر ماندن
const leftovers = {
  ordersMyPhones: await db.order.count({ where: { OR: myPhones.map((p) => ({ phone: { startsWith: p } })) } }),
  directOrders: await db.order.count({ where: { id: { in: directOrderIds } } }),
  couponsH60A: await db.coupon.count({ where: { code: { startsWith: "H60A" } } }),
  redemptionsMine: await db.couponRedemption.count({ where: { OR: [{ orderId: { in: orderIds } }, { userId: { in: myUserIds } }] } }),
  users0923: await db.user.count({ where: { phone: { startsWith: "0923" }, createdAt: { gte: since } } }),
  myProducts: await db.product.count({ where: { slug: { startsWith: "h60p" } } }),
  paymentsMine: await db.payment.count({ where: { orderId: { in: orderIds } } }),
  reservationsMine: await db.inventoryReservation.count({ where: { orderId: { in: orderIds } } }),
  outboxMine: await db.outboxEvent.count({ where: { OR: orderIds.map((o) => ({ payload: { path: ["orderId"], equals: o } })) } }),
  fixtureProductIntact: Boolean(await db.product.findFirst({ where: { slug: "test-inactive-all-variants" }, select: { id: true } })),
  seedIntact: {
    products: await db.product.count(),
    ordersTotal: await db.order.count(),
  },
};
console.log("CLEANUP CHECK:", JSON.stringify(leftovers, null, 1));
await db.$disconnect();
