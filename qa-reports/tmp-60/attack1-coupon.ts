/**
 * حملهٔ ۱ (redteam 60) — رقابت کوپن perUserLimit روی consumeCouponInTx
 * A: کوپن perUser=2 + ۲۰ سفارش مهمان → ۲۰ tx موازی → انتظار دقیقاً ۲ موفق
 * B: کوپن perUser=3 + ۱۰ کاربر لاگین + ۱۰ مهمان موازی → انتظار مهمان=3، کاربر=10، جمع=13
 * C: سقف per-user سریالی — کاربر B تا سقف ۳ و تلاش چهارم باید رد شود
 */
import { PrismaClient } from "@prisma/client";
import { consumeCouponInTx } from "../../src/core/commerce/coupon-service";
import { DomainError } from "../../src/core/errors";

const db = new PrismaClient();
const RUN = `h60a${Date.now().toString(36)}`;
const phoneMark = `0923`; // برای cleanup بعدی — کاربران این حمله همه با 0923 شروع می‌شوند
const orderIds: string[] = [];
const userIds: string[] = [];
const couponIds: string[] = [];
const report: Record<string, unknown> = { RUN };

async function makeCoupon(perUserLimit: number | null, usageLimit: number | null) {
  const c = await db.coupon.create({
    data: {
      code: `${RUN}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
      type: "PERCENT",
      value: 10,
      usageLimit,
      perUserLimit,
      isActive: true,
    },
    select: { id: true, code: true },
  });
  couponIds.push(c.id);
  return c;
}

async function makeOrder(phone: string, userId?: string | null) {
  const o = await db.order.create({
    data: {
      code: `H6${Math.random().toString(36).slice(2, 10)}`.slice(0, 10),
      userId: userId ?? null,
      phone,
      status: "PENDING",
      subtotal: 500_000,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 500_000,
      currency: "IRT",
      shippingAddress: { fullName: "redteam-60", phone },
      placedAt: new Date(),
    },
    select: { id: true },
  });
  orderIds.push(o.id);
  return o;
}

async function makeUser() {
  const role = (await db.role.findFirst())!;
  const u = await db.user.create({
    data: { phone: `${phoneMark}${Math.floor(1e8 + Math.random() * 9e8)}`.slice(0, 11), roleId: role.id },
  });
  userIds.push(u.id);
  return u;
}

// ── فاز A: ۲۰ مهمان موازی روی perUser=2
const couponA = await makeCoupon(2, null);
const ordersA = await Promise.all(
  Array.from({ length: 20 }, (_, i) => makeOrder(`0931${String(i).padStart(7, "0")}`.slice(0, 11))),
);
const resA = await Promise.allSettled(
  ordersA.map((o) =>
    db.$transaction((tx) => consumeCouponInTx(tx, { couponId: couponA.id, orderId: o.id, userId: null })),
  ),
);
const okA = resA.filter((r) => r.status === "fulfilled").length;
const errA: Record<string, number> = {};
for (const r of resA) if (r.status === "rejected") {
  const code = (r.reason as DomainError)?.code ?? (r.reason as Error)?.constructor.name;
  errA[code] = (errA[code] ?? 0) + 1;
}
const guestRedA = await db.couponRedemption.count({ where: { couponId: couponA.id, userId: null } });
const usedA = (await db.coupon.findUniqueOrThrow({ where: { id: couponA.id } })).usedCount;
report.A = { attempts: 20, ok: okA, errA, guestRedemptions: guestRedA, usedCount: usedA };
console.log("A:", JSON.stringify(report.A));

// ── فاز B: ۱۰ کاربر + ۱۰ مهمان موازی روی perUser=3
const couponB = await makeCoupon(3, null);
const users = await Promise.all(Array.from({ length: 10 }, () => makeUser()));
const userOrders = await Promise.all(users.map((u, i) => makeOrder(`0932${String(i).padStart(7, "0")}`.slice(0, 11), u.id)));
const guestOrdersB = await Promise.all(
  Array.from({ length: 10 }, (_, i) => makeOrder(`0933${String(i).padStart(7, "0")}`.slice(0, 11))),
);
const jobs = [
  ...userOrders.map((o, i) =>
    db.$transaction((tx) => consumeCouponInTx(tx, { couponId: couponB.id, orderId: o.id, userId: users[i].id }))
      .then(() => ({ kind: "user", idx: i, ok: true as const }))
      .catch((e) => ({ kind: "user", idx: i, ok: false as const, code: (e as DomainError)?.code ?? String(e) })),
  ),
  ...guestOrdersB.map((o, i) =>
    db.$transaction((tx) => consumeCouponInTx(tx, { couponId: couponB.id, orderId: o.id, userId: null }))
      .then(() => ({ kind: "guest", idx: i, ok: true as const }))
      .catch((e) => ({ kind: "guest", idx: i, ok: false as const, code: (e as DomainError)?.code ?? String(e) })),
  ),
];
const resB = await Promise.all(jobs);
const okUsers = resB.filter((r) => r.kind === "user" && r.ok).length;
const okGuests = resB.filter((r) => r.kind === "guest" && r.ok).length;
const perUserCounts = await db.couponRedemption.groupBy({
  by: ["userId"],
  where: { couponId: couponB.id },
  _count: { _all: true },
});
const maxPerUser = Math.max(0, ...perUserCounts.map((p) => p._count._all));
const guestRedB = await db.couponRedemption.count({ where: { couponId: couponB.id, userId: null } });
report.B = { attempts: 20, okUsers, okGuests, total: okUsers + okGuests, maxPerUser, guestRedemptions: guestRedB };
console.log("B:", JSON.stringify(report.B));

// ── فاز C: سقف سریالی per-user — یک کاربر تا ۳ می‌رود، چهارمی رد می‌شود
const victim = users[0];
const extraOrders = [
  await makeOrder(`0934${Math.floor(1e7 + Math.random() * 9e7)}`.slice(0, 11), victim.id),
  await makeOrder(`0935${Math.floor(1e7 + Math.random() * 9e7)}`.slice(0, 11), victim.id),
  await makeOrder(`0936${Math.floor(1e7 + Math.random() * 9e7)}`.slice(0, 11), victim.id),
];
const c2nd = await db.$transaction((tx) => consumeCouponInTx(tx, { couponId: couponB.id, orderId: extraOrders[0].id, userId: victim.id })).then(() => "OK").catch((e) => (e as DomainError).code);
const c3rd = await db.$transaction((tx) => consumeCouponInTx(tx, { couponId: couponB.id, orderId: extraOrders[1].id, userId: victim.id })).then(() => "OK").catch((e) => (e as DomainError).code);
const c4th = await db.$transaction((tx) => consumeCouponInTx(tx, { couponId: couponB.id, orderId: extraOrders[2].id, userId: victim.id })).then(() => "OK").catch((e) => (e as DomainError).code);
const victimTotal = await db.couponRedemption.count({ where: { couponId: couponB.id, userId: victim.id } });
report.C = { secondConsume: c2nd, thirdConsume: c3rd, fourthConsume: c4th, victimRedemptions: victimTotal };
console.log("C:", JSON.stringify(report.C));

// ── رأی
const verdicts = {
  A_exact2: okA === 2 && guestRedA === 2 && usedA === 2,
  B_guest_le3: guestRedB <= 3,
  B_users_le1each: maxPerUser <= 3 && okUsers <= 10,
  B_total_le13: okUsers + okGuests <= 13,
  C_cap3_serial: c2nd === "OK" && c3rd === "OK" && c4th === "COUPON_INVALID" && victimTotal === 3,
  usedCountMatches: (await db.coupon.findUniqueOrThrow({ where: { id: couponB.id } })).usedCount ===
    (await db.couponRedemption.count({ where: { couponId: couponB.id } })),
};
report.verdicts = verdicts;
report.BREACHED = !Object.values(verdicts).every(Boolean);
console.log("VERDICT:", JSON.stringify(report.verdicts), "BREACHED=", report.BREACHED);

await Bun.write(new URL("./attack1-result.json", import.meta.url), JSON.stringify(report, null, 1));
await db.$disconnect();
