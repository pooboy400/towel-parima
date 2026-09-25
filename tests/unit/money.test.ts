import { describe, expect, it } from "bun:test";
import {
  calcCouponDiscount,
  calcGrandTotal,
  calcShipping,
  calcSubtotal,
  assertMoney,
} from "../../src/domain/policies/money";
import { DomainError } from "../../src/core/errors";

describe("calcSubtotal — Integer محض", () => {
  it("جمع ساده", () => {
    expect(
      calcSubtotal([
        { unitPrice: 250_000, quantity: 2 },
        { unitPrice: 180_000, quantity: 1 },
      ]),
    ).toBe(680_000);
  });

  it("سبد خالی = 0", () => {
    expect(calcSubtotal([])).toBe(0);
  });
});

describe("calcCouponDiscount — بخش ۱۲ سند (گرد کردن floor به نفع مشتری)", () => {
  it("PERCENT با گرد کردن floor", () => {
    // 350,000 × 15% = 52,500
    const r = calcCouponDiscount({
      subtotal: 350_000,
      coupon: { type: "PERCENT", value: 15, maxDiscount: null, minSubtotal: null },
    });
    expect(r.discount).toBe(52_500);
  });

  it("PERCENT غیر رند → floor (335,000 × 3% = 10050)", () => {
    const r = calcCouponDiscount({
      subtotal: 335_000,
      coupon: { type: "PERCENT", value: 3, maxDiscount: null, minSubtotal: null },
    });
    expect(r.discount).toBe(10_050);
  });

  it("سقف maxDiscount اعمال می‌شود", () => {
    const r = calcCouponDiscount({
      subtotal: 1_000_000,
      coupon: { type: "PERCENT", value: 50, maxDiscount: 200_000, minSubtotal: null },
    });
    expect(r.discount).toBe(200_000);
  });

  it("FIXED هرگز از subtotal بیشتر نمی‌شود", () => {
    const r = calcCouponDiscount({
      subtotal: 100_000,
      coupon: { type: "FIXED", value: 500_000, maxDiscount: null, minSubtotal: null },
    });
    expect(r.discount).toBe(100_000);
  });

  it("درصد خارج از 1..100 رد می‌شود", () => {
    expect(() =>
      calcCouponDiscount({
        subtotal: 100_000,
        coupon: { type: "PERCENT", value: 150, maxDiscount: null, minSubtotal: null },
      }),
    ).toThrow(DomainError);
  });

  it("Float مطلقاً رد می‌شود — اصل پول Integer", () => {
    expect(() =>
      calcCouponDiscount({
        subtotal: 100_000.5,
        coupon: { type: "PERCENT", value: 10, maxDiscount: null, minSubtotal: null },
      }),
    ).toThrow(DomainError);
  });
});

describe("calcGrandTotal — فرمول سند", () => {
  it("grandTotal = subtotal − discount + shipping + tax", () => {
    expect(
      calcGrandTotal({ subtotal: 500_000, discountTotal: 50_000, shippingTotal: 40_000 }),
    ).toBe(490_000);
  });

  it("مجموع منفی رد می‌شود", () => {
    expect(() =>
      calcGrandTotal({ subtotal: 100_000, discountTotal: 500_000, shippingTotal: 0 }),
    ).toThrow(DomainError);
  });
});

describe("calcShipping", () => {
  const config = { flatFee: 45_000, freeThreshold: 800_000 };

  it("بالای آستانه → رایگان", () => {
    expect(calcShipping(900_000, config)).toBe(0);
  });

  it("زیر آستانه → هزینه ثابت", () => {
    expect(calcShipping(500_000, config)).toBe(45_000);
  });
});

describe("assertMoney", () => {
  it("منفی و اعشاری رد می‌شوند", () => {
    expect(() => assertMoney(-1)).toThrow(DomainError);
    expect(() => assertMoney(1.5)).toThrow(DomainError);
    expect(() => assertMoney(0)).not.toThrow();
  });
});
