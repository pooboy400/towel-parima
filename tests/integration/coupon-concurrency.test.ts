/**
 * Integration — تست پذیرش فاز ۲: BUG-01 + BUG-02 (سقف‌های کوپن در رقابت)
 * ---------------------------------------------------------------
 * BUG-01: سقف perUserLimit با count-then-create ناامن بود (TOCTOU) —
 *         الان consumeCouponInTx با قفل SELECT … FOR UPDATE سریال می‌شود.
 *         پذیرش: ۱۰ مصرف موازی با سقف perUser=۱ → دقیقاً ۱ Redemption.
 * BUG-02 (ADR سقف مهمان): مهمان‌ها یک سبد گمنام مشترک دارند —
 *         پذیرش: مهمان با ۳ شمارهٔ مختلف و سقف perUser=۱ → فقط ۱ مصرف موفق.
 * + رگرسیون: usageLimit اتمیک قبلی باید سر جایش بماند (۱۰ موازی / سقف ۳ → ۳ مصرف).
 * اجرا: DATABASE_URL=... bun test tests/integration/coupon-concurrency.test.ts
 */
import { describe, expect, it, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { consumeCouponInTx, evaluateCoupon } from "../../src/core/commerce/coupon-service";
import { DomainError } from "../../src/core/errors";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";
const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const RUN = `cc-${Date.now()}`;
const cleanupIds: { coupon?: string; userId?: string; orderIds: string[] } = {
  orderIds: [],
};

/** سفارش PENDING حداقلی — فقط برای FK ردیف Redemption */
async function makeGuestOrder(phone: string, userId?: string): Promise<{ id: string }> {
  const order = await db.order.create({
    data: {
      code: `CC${Math.random().toString(36).slice(2, 10)}`.slice(0, 10),
      userId: userId ?? null,
      phone,
      status: "PENDING",
      subtotal: 500_000,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 500_000,
      currency: "IRT",
      shippingAddress: { fullName: "تست کوپن", phone },
      placedAt: new Date(),
    },
    select: { id: true },
  });
  cleanupIds.orderIds.push(order.id);
  return order;
}

async function makeCoupon(input: {
  perUserLimit?: number | null;
  usageLimit?: number | null;
}): Promise<{ id: string; code: string }> {
  const coupon = await db.coupon.create({
    data: {
      code: `${RUN}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
      type: "PERCENT",
      value: 10,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      isActive: true,
    },
    select: { id: true, code: true },
  });
  cleanupIds.coupon = coupon.id;
  return coupon;
}

describe("BUG-01 — قفل رقابتی perUserLimit (TOCTOU)", () => {
  it("۱۰ مصرف موازی یک کاربر با سقف perUser=۱ → دقیقاً ۱ Redemption", async () => {
    const role = (await db.role.findFirst())!;
    const user = await db.user.create({
      data: { phone: `0912${Math.floor(1e7 + Math.random() * 9e7)}`.slice(0, 11), roleId: role.id },
    });
    cleanupIds.userId = user.id;

    const coupon = await makeCoupon({ perUserLimit: 1 });
    const orders = await Promise.all(
      Array.from({ length: 10 }, (_, i) => makeGuestOrder(`0912${i}000000`.slice(0, 11), user.id)),
    );

    const results = await Promise.allSettled(
      orders.map((o) =>
        db.$transaction((tx) =>
          consumeCouponInTx(tx, { couponId: coupon.id, orderId: o.id, userId: user.id }),
        ),
      ),
    );

    const okCount = results.filter((r) => r.status === "fulfilled").length;
    expect(okCount).toBe(1);

    const redemptions = await db.couponRedemption.count({
      where: { couponId: coupon.id, userId: user.id },
    });
    expect(redemptions).toBe(1);

    const fresh = await db.coupon.findUnique({ where: { id: coupon.id } });
    expect(fresh?.usedCount).toBe(1);
  });

  it("مصرف دوم سریالی همان کاربر با COUPON_INVALID رد می‌شود", async () => {
    const role = (await db.role.findFirst())!;
    const user = await db.user.create({
      data: { phone: `0913${Math.floor(1e7 + Math.random() * 9e7)}`.slice(0, 11), roleId: role.id },
    });
    const coupon = await makeCoupon({ perUserLimit: 1 });
    const o1 = await makeGuestOrder(`09130000001`.slice(0, 11), user.id);
    const o2 = await makeGuestOrder(`09130000002`.slice(0, 11), user.id);

    await db.$transaction((tx) =>
      consumeCouponInTx(tx, { couponId: coupon.id, orderId: o1.id, userId: user.id }),
    );
    try {
      await db.$transaction((tx) =>
        consumeCouponInTx(tx, { couponId: coupon.id, orderId: o2.id, userId: user.id }),
      );
      throw new Error("نباید به اینجا برسیم");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe("COUPON_INVALID");
    }
  });
});

describe("BUG-02 — سقف مهمان (سبد گمنام مشترک — ADR)", () => {
  it("مهمان با ۳ شمارهٔ مختلف و سقف perUser=۱ → فقط ۱ مصرف موفق", async () => {
    const coupon = await makeCoupon({ perUserLimit: 1 });
    const orders = await Promise.all([
      makeGuestOrder(`09140000001`),
      makeGuestOrder(`09140000002`),
      makeGuestOrder(`09140000003`),
    ]);

    const results = await Promise.allSettled(
      orders.map((o) =>
        db.$transaction((tx) =>
          consumeCouponInTx(tx, { couponId: coupon.id, orderId: o.id, userId: null }),
        ),
      ),
    );

    const okCount = results.filter((r) => r.status === "fulfilled").length;
    expect(okCount).toBe(1);

    const guestRedemptions = await db.couponRedemption.count({
      where: { couponId: coupon.id, userId: null },
    });
    expect(guestRedemptions).toBe(1);
  });

  it("پس از پر شدن سبد گمنام، پیش‌نمایش مهمان هم با پیام شفاف رد می‌شود", async () => {
    const coupon = await makeCoupon({ perUserLimit: 1 });
    const o1 = await makeGuestOrder(`09150000001`);
    await db.$transaction((tx) =>
      consumeCouponInTx(tx, { couponId: coupon.id, orderId: o1.id, userId: null }),
    );

    try {
      await evaluateCoupon(coupon.code, 500_000, null);
      throw new Error("نباید به اینجا برسیم");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).message).toContain("مهمان");
    }
  });

  it("کاربر لاگین از سبد گمنام جدا شمرده می‌شود", async () => {
    const role = (await db.role.findFirst())!;
    const user = await db.user.create({
      data: { phone: `0916${Math.floor(1e7 + Math.random() * 9e7)}`.slice(0, 11), roleId: role.id },
    });
    const coupon = await makeCoupon({ perUserLimit: 1 });
    const oGuest = await makeGuestOrder(`09160000001`);
    const oUser = await makeGuestOrder(`09160000002`, user.id);

    await db.$transaction((tx) =>
      consumeCouponInTx(tx, { couponId: coupon.id, orderId: oGuest.id, userId: null }),
    );
    // مهمان سهمیه را پر کرده ولی کاربر لاگین سهمیهٔ خودش را دارد
    await db.$transaction((tx) =>
      consumeCouponInTx(tx, { couponId: coupon.id, orderId: oUser.id, userId: user.id }),
    );

    const counts = await db.couponRedemption.count({ where: { couponId: coupon.id } });
    expect(counts).toBe(2);
  });
});

describe("رگرسیون — سقف کلی usageLimit همچنان اتمیک", () => {
  it("۱۰ مصرف موازی با سقف کلی ۳ → دقیقاً ۳ Redemption", async () => {
    const coupon = await makeCoupon({ usageLimit: 3 });
    const orders = await Promise.all(
      Array.from({ length: 10 }, (_, i) => makeGuestOrder(`0917${i}000000`.slice(0, 11))),
    );

    const results = await Promise.allSettled(
      orders.map((o) =>
        db.$transaction((tx) =>
          consumeCouponInTx(tx, { couponId: coupon.id, orderId: o.id, userId: null }),
        ),
      ),
    );

    const okCount = results.filter((r) => r.status === "fulfilled").length;
    expect(okCount).toBe(3);

    const fresh = await db.coupon.findUnique({ where: { id: coupon.id } });
    expect(fresh?.usedCount).toBe(3);
  });
});

/** کمک‌ساز حذف شد — کد کوپن مستقیماً از makeCoupon برگردانده می‌شود */

afterAll(async () => {
  // پاکسازی به ترتیب FK
  await db.couponRedemption.deleteMany({ where: { OR: [{ couponId: cleanupIds.coupon ?? "" }, { orderId: { in: cleanupIds.orderIds } }] } });
  if (cleanupIds.coupon) await db.coupon.deleteMany({ where: { id: cleanupIds.coupon } });
  await db.order.deleteMany({ where: { id: { in: cleanupIds.orderIds } } });
  if (cleanupIds.userId) await db.user.deleteMany({ where: { id: cleanupIds.userId } });
  // کاربران بدون cleanup-id (تست‌های میانی)
  await db.user.deleteMany({ where: { phone: { startsWith: "0913" } } });
  await db.user.deleteMany({ where: { phone: { startsWith: "0916" } } });
  await db.coupon.deleteMany({ where: { code: { startsWith: `${RUN}-` } } });
  await db.$disconnect();
});
