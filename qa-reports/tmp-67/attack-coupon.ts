/**
 * 67-hack — حملهٔ ۱ و ۲: رقابت کوپن در سطح سرویس (فاز ۳ — BUG-01/BUG-02)
 * ---------------------------------------------------------------
 * برخلاف باتری ۶۰ (که consumeCouponInTx را مستقیم صدا می‌زد) این‌بار مسیر کامل
 * placeOrder (tx واقعی: رزرو + کوپن + outbox) با ۱۵/۲۸ تراکنش همزمان حمله می‌شود.
 *
 * حملهٔ ۱: کوپن perUserLimit=2 + ۱۵ سفارش «مهمان» موازی → انتظار دقیقاً ۲ موفق
 * حملهٔ ۲: کوپن perUserLimit=3 + ۵ کاربر ساختهٔ خودم (۴ تلاش هرکدام) + ۸ مهمان موازی
 *          → انتظار: هر کاربر دقیقاً ۳ · مهمان‌ها جمعاً دقیقاً ۳ · جمع ۱۸
 *
 * ⚠️ قاعده: فقط ردیف‌های خودت — کوپن‌ها/سفارش‌ها/کاربران با نشان HACK67 ساخته می‌شوند.
 */
import { PrismaClient } from "@prisma/client";
import { placeOrder } from "../../src/core/commerce/checkout-service";
import { DomainError } from "../../src/core/errors";
import { cleanupMyRows } from "./cleanup-67";

const db = new PrismaClient();
// شروع تمیز — فقط بقایای ران قبلی خودمان پاک می‌شود (همان نمونهٔ client)
await cleanupMyRows(db);
const RUN = "HACK67";
const VARIANT_A = "cmuib13xy001pnd15utkqaxqp"; // حوله مهمان راه‌راه — free=20 (حمله ۱)
const VARIANT_B = "cmuib13xy001nnd15kqd7n890"; // حوله مهمان راه‌راه — free=20 (حمله ۲)
const va = (await db.variant.findUnique({ where: { id: VARIANT_A } }))!;
const vb = (await db.variant.findUnique({ where: { id: VARIANT_B } }))!;
const TRIPLE_A = { productId: va.productId, colorId: va.colorId, sizeId: va.sizeId };
const TRIPLE_B = { productId: vb.productId, colorId: vb.colorId, sizeId: vb.sizeId };

const report: Record<string, unknown> = { RUN, startedAt: new Date().toISOString() };
const myOrderIds: string[] = [];
const myUserIds: string[] = [];
const myCouponIds: string[] = [];

function classify(e: unknown) {
  if (e instanceof DomainError) return { code: e.code, message: e.message };
  return { code: "UNKNOWN", message: (e as Error).message };
}

async function makeCoupon(code: string, perUserLimit: number) {
  // حذف بقایای ران قبلی خودمان (کوپن‌های HACK67 بدون مصرف)
  await db.coupon.deleteMany({ where: { code, deletedAt: null } });
  const c = await db.coupon.create({
    data: { code, type: "FIXED", value: 1000, usageLimit: null, perUserLimit, isActive: true },
    select: { id: true, code: true },
  });
  myCouponIds.push(c.id);
  return c;
}

async function makeUser(i: number) {
  const role = await db.role.findFirst({ select: { id: true } });
  // پسوند تصادفی — تصادم با کاربران واقعی/تستی موجود را دوری می‌کنیم
  let u: { id: string; phone: string } | null = null;
  for (let t = 0; t < 10 && !u; t++) {
    const phone = `0933677${String(Math.floor(1000 + Math.random() * 9000))}${i}`;
    try {
      u = await db.user.create({
        data: { phone: phone.slice(0, 11), name: `redteam67-u${i}`, roleId: role?.id ?? null },
        select: { id: true, phone: true },
      });
    } catch {
      /* تصادم شماره — دوباره */
    }
  }
  if (!u) throw new Error("makeUser failed after retries");
  myUserIds.push(u.id);
  return u;
}

function guestAddress(i: number) {
  return {
    fullName: `${RUN}-guest${i}`,
    phone: `093367000${String(i).padStart(2, "0")}`,
    province: "تهران",
    city: "تهران",
    postalCode: "1111111111",
    line: "خیابان قرمزتیم ۶۷",
  };
}

function attempt(opts: {
  triple: { productId: string; colorId: string | null; sizeId: string | null };
  couponCode: string;
  userId?: string | null;
  addrIdx: number;
}) {
  return placeOrder({
    userId: opts.userId ?? null,
    lines: [{ ...opts.triple, quantity: 1 }],
    address: guestAddress(opts.addrIdx),
    shippingMethod: "standard",
    couponCode: opts.couponCode,
    note: `${RUN} attack`,
  }).then(
    (r) => {
      myOrderIds.push(r.orderId);
      return { ok: true, orderCode: r.orderCode } as const;
    },
    (e) => ({ ok: false, ...classify(e) }) as const,
  );
}

/* ────────────── حملهٔ ۱ — ۱۵ مهمان موازی روی perUser=2 ────────────── */
{
  const coupon = await makeCoupon(`${RUN}-G2`, 2);
  console.log(`[1] coupon=${coupon.code} perUserLimit=2 → 15 parallel GUEST placeOrder`);
  const results = await Promise.all(
    Array.from({ length: 15 }, (_, i) =>
      attempt({ triple: TRIPLE_A, couponCode: coupon.code, addrIdx: i }),
    ),
  );
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok) as Extract<(typeof results)[number], { ok: false }>[];
  const redeem = await db.couponRedemption.count({ where: { couponId: coupon.id } });
  const redeemNull = await db.couponRedemption.count({
    where: { couponId: coupon.id, userId: null },
  });
  const usedCount = (await db.coupon.findUnique({ where: { id: coupon.id } }))!.usedCount;
  const failCodes = Object.entries(
    fail.reduce<Record<string, number>>((a, f) => ((a[f.code] = (a[f.code] ?? 0) + 1), a), {}),
  );
  report.attack1_guests = {
    attempts: 15,
    succeeded: ok.length,
    failed: fail.length,
    failCodes,
    redemptions: redeem,
    guestRedemptions: redeemNull,
    usedCount,
    verdict: redeem === 2 && redeemNull === 2 ? "EXACTLY_2 ✅" : "OVERSPEND ❌",
  };
  console.log(JSON.stringify(report.attack1_guests, null, 1));
}

/* ────────────── حملهٔ ۲ — ۵ کاربر×۴ + ۸ مهمان موازی روی perUser=3 ────────────── */
{
  const coupon = await makeCoupon(`${RUN}-C3`, 3);
  const users = await Promise.all([1, 2, 3, 4, 5].map((i) => makeUser(i)));
  console.log(`[2] coupon=${coupon.code} perUserLimit=3 → 5 users×4 + 8 guests = 28 parallel`);
  const jobs: Promise<Readonly<{ ok: true; orderCode: string; who: string } | { ok: false; code: string; message: string; who: string }>>[] = [];
  let addrIdx = 100;
  for (const u of users) {
    for (let k = 0; k < 4; k++) {
      const j = attempt({ triple: TRIPLE_B, couponCode: coupon.code, userId: u.id, addrIdx: addrIdx++ })
        .then((r) => ({ ...r, who: `user:${u.phone}` }) as const);
      jobs.push(j as never);
    }
  }
  for (let i = 0; i < 8; i++) {
    const j = attempt({ triple: TRIPLE_B, couponCode: coupon.code, addrIdx: addrIdx++ })
      .then((r) => ({ ...r, who: "guest" }) as const);
    jobs.push(j as never);
  }
  const results = await Promise.all(jobs);
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok) as Extract<(typeof results)[number], { ok: false }>[];
  const perUser = await db.couponRedemption.groupBy({
    by: ["userId"],
    where: { couponId: coupon.id },
    _count: { _all: true },
  });
  const userRedeems = perUser.filter((r) => r.userId !== null);
  const guestRedeems = perUser.find((r) => r.userId === null)?._count._all ?? 0;
  const usedCount = (await db.coupon.findUnique({ where: { id: coupon.id } }))!.usedCount;
  report.attack2_combo = {
    attempts: 28,
    succeeded: ok.length,
    failed: fail.length,
    perUserCounts: userRedeems.map((r) => ({ userId: r.userId, count: r._count._all })),
    eachUserExactly3: userRedeems.every((r) => r._count._all === 3) && userRedeems.length === 5,
    guestRedemptions: guestRedeems,
    totalRedemptions: userRedeems.reduce((s, r) => s + r._count._all, 0) + guestRedeems,
    usedCount,
    failCodes: Object.entries(
      fail.reduce<Record<string, number>>((a, f) => ((a[f.code] = (a[f.code] ?? 0) + 1), a), {}),
    ),
    verdict:
      userRedeems.length === 5 &&
      userRedeems.every((r) => r._count._all === 3) &&
      guestRedeems === 3
        ? "LIMITS_EXACT ✅"
        : "LIMITS_BREACHED ❌",
  };
  console.log(JSON.stringify(report.attack2_combo, null, 1));
}

/* ── شواهد DB برای cleanup: نشان HACK67 ── */
report.cleanupLedger = {
  orderIds: myOrderIds,
  userIds: myUserIds,
  couponIds: myCouponIds,
  phones: ["09336700000–09336700114", "093367000100–093367000107", "09336760001–05"],
};
await Bun.write(new URL("./attack-coupon-result.json", import.meta.url), JSON.stringify(report, null, 2));
await db.$disconnect();
console.log("DONE → qa-reports/tmp-67/attack-coupon-result.json");
