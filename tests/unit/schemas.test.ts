import { describe, expect, it } from "bun:test";
import {
  addressV2Schema,
  applyCouponSchema,
  cartItemV2Schema,
  checkoutSchema,
  phoneSchema,
  sendOtpSchema,
  submitReviewSchema,
  verifyOtpSchema,
} from "../../src/domain/schemas";

describe("phoneSchema — ارقام فارسی پذیرفته و نرمال می‌شوند", () => {
  it("قالب استاندارد", () => {
    expect(phoneSchema.parse("09121234567")).toBe("09121234567");
  });

  it("ارقام فارسی → لاتین", () => {
    expect(phoneSchema.parse("۰۹۱۲۱۲۳۴۵۶۷")).toBe("09121234567");
  });

  it("قالب‌های نامعتبر رد می‌شوند", () => {
    expect(() => phoneSchema.parse("9121234567")).toThrow();
    expect(() => phoneSchema.parse("0912123456")).toThrow();
    expect(() => phoneSchema.parse("")).toThrow();
  });
});

describe("sendOtp / verifyOtp", () => {
  it("sendOtp فقط phone می‌گیرد", () => {
    expect(sendOtpSchema.parse({ phone: "۰۹۱۲۱۲۳۴۵۶۷" })).toEqual({
      phone: "09121234567",
    });
  });

  it("verifyOtp کد ۶ رقمی فارسی را هم می‌پذیرد", () => {
    const r = verifyOtpSchema.parse({ phone: "09121234567", code: "۱۲۳۴۵۶" });
    expect(r.code).toBe("123456");
  });

  it("کد ۵ رقمی رد می‌شود", () => {
    expect(() => verifyOtpSchema.parse({ phone: "09121234567", code: "12345" })).toThrow();
  });
});

describe("addressV2Schema", () => {
  const valid = {
    fullName: "علی رضایی",
    phone: "09121234567",
    province: "تهران",
    city: "تهران",
    postalCode: "1234567890",
    line: "خیابان ولیعصر پلاک ۱ طبقه ۲",
  };

  it("آدرس کامل قبول می‌شود", () => {
    expect(addressV2Schema.parse(valid).postalCode).toBe("1234567890");
  });

  it("کدپستی با ارقام فارسی قبول می‌شود", () => {
    expect(addressV2Schema.parse({ ...valid, postalCode: "۱۲۳۴۵۶۷۸۹۰" }).postalCode).toBe(
      "1234567890",
    );
  });

  it("آدرس خیلی کوتاه رد می‌شود", () => {
    expect(() => addressV2Schema.parse({ ...valid, line: "کوتاه" })).toThrow();
  });
});

describe("checkoutSchema", () => {
  const address = {
    fullName: "علی رضایی",
    phone: "09121234567",
    province: "تهران",
    city: "تهران",
    postalCode: "1234567890",
    line: "خیابان ولیعصر پلاک ۱ طبقه ۲",
  };

  it("checkout سالم", () => {
    const r = checkoutSchema.parse({
      items: [{ variantId: "cuid123", quantity: 2 }],
      address,
    });
    expect(r.items.length).toBe(1);
    expect(r.couponCode).toBeUndefined();
  });

  it("کد کوپن خودکار uppercase می‌شود", () => {
    const r = checkoutSchema.parse({
      items: [{ variantId: "c1", quantity: 1 }],
      address,
      couponCode: "prima10",
    });
    expect(r.couponCode).toBe("PRIMA10");
  });

  it("quantity > 20 رد می‌شود (ERD سند)", () => {
    expect(() => cartItemV2Schema.parse({ variantId: "c1", quantity: 21 })).toThrow();
    expect(() => cartItemV2Schema.parse({ variantId: "c1", quantity: 0 })).toThrow();
  });

  it("سبد خالی رد می‌شود", () => {
    expect(() => checkoutSchema.parse({ items: [], address })).toThrow();
  });
});

describe("applyCouponSchema + submitReviewSchema", () => {
  it("کوپن uppercase + subtotal", () => {
    expect(applyCouponSchema.parse({ code: " ab12 ", subtotal: 500_000 })).toEqual({
      code: "AB12",
      subtotal: 500_000,
    });
  });

  it("امتیاز خارج از 1..5 رد می‌شود", () => {
    const base = {
      productSlug: "towel-x",
      authorName: "علی",
      body: "محصول خیلی خوبی بود و راضی هستم",
    };
    expect(() => submitReviewSchema.parse({ ...base, rating: 0 })).toThrow();
    expect(() => submitReviewSchema.parse({ ...base, rating: 6 })).toThrow();
    expect(submitReviewSchema.parse({ ...base, rating: 5 }).rating).toBe(5);
  });
});
