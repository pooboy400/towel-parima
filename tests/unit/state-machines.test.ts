import { describe, expect, it } from "bun:test";
import {
  assertOrderTransition,
  checkTransition,
  CONTENT_TRANSITIONS,
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  REFUND_TRANSITIONS,
  RESERVATION_TRANSITIONS,
  REVIEW_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
} from "../../src/domain/state-machines";
import { DomainError } from "../../src/core/errors";

describe("Order state machine — جدول بخش ۵.۱ سند", () => {
  it("مسیر خوش‌مسیر: PENDING → PROCESSING → SHIPPED → DELIVERED", () => {
    expect(checkTransition(ORDER_TRANSITIONS, "PENDING", "PROCESSING").allowed).toBe(true);
    expect(checkTransition(ORDER_TRANSITIONS, "PROCESSING", "SHIPPED").allowed).toBe(true);
    expect(checkTransition(ORDER_TRANSITIONS, "SHIPPED", "DELIVERED").allowed).toBe(true);
  });

  it("لغو از PENDING و PROCESSING مجاز، از SHIPPED/DELIVERED ممنوع", () => {
    expect(checkTransition(ORDER_TRANSITIONS, "PENDING", "CANCELLED").allowed).toBe(true);
    expect(checkTransition(ORDER_TRANSITIONS, "PROCESSING", "CANCELLED").allowed).toBe(true);
    expect(checkTransition(ORDER_TRANSITIONS, "SHIPPED", "CANCELLED").allowed).toBe(false);
    expect(checkTransition(ORDER_TRANSITIONS, "DELIVERED", "CANCELLED").allowed).toBe(false);
  });

  it("مرجوعی فقط از DELIVERED", () => {
    expect(checkTransition(ORDER_TRANSITIONS, "DELIVERED", "RETURN_REQUESTED").allowed).toBe(true);
    expect(checkTransition(ORDER_TRANSITIONS, "RETURN_REQUESTED", "RETURNED").allowed).toBe(true);
    expect(checkTransition(ORDER_TRANSITIONS, "PROCESSING", "RETURN_REQUESTED").allowed).toBe(false);
  });

  it("گذار رو به عقب ممنوع است", () => {
    expect(checkTransition(ORDER_TRANSITIONS, "SHIPPED", "PROCESSING").allowed).toBe(false);
    expect(checkTransition(ORDER_TRANSITIONS, "DELIVERED", "SHIPPED").allowed).toBe(false);
    expect(checkTransition(ORDER_TRANSITIONS, "CANCELLED", "PENDING").allowed).toBe(false);
  });

  it("assertOrderTransition مجری اشتباه را با FORBIDDEN رد می‌کند", () => {
    // PROCESSING → SHIPPED فقط ادمین
    try {
      assertOrderTransition("PROCESSING", "SHIPPED", "customer");
      throw new Error("نباید به اینجا برسیم");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      const err = e as DomainError;
      expect(err.code).toBe("INVALID_TRANSITION");
      expect(err.status).toBe(403);
    }
  });

  it("assertOrderTransition گذار ناشناخته با 409", () => {
    try {
      assertOrderTransition("DELIVERED", "PROCESSING", "admin");
      throw new Error("نباید به اینجا برسیم");
    } catch (e) {
      const err = e as DomainError;
      expect(err.code).toBe("INVALID_TRANSITION");
      expect(err.status).toBe(409);
    }
  });

  it("گذارهای ادمین permission درست دارند", () => {
    const shipped = ORDER_TRANSITIONS.find(
      (r) => r.from === "PROCESSING" && r.to === "SHIPPED",
    );
    expect(shipped?.adminPermission).toBe("orders.update");
  });
});

describe("Payment state machine — بخش ۵.۲", () => {
  it("PENDING → PAID و PENDING → FAILED مجاز", () => {
    expect(checkTransition(PAYMENT_TRANSITIONS, "PENDING", "PAID").allowed).toBe(true);
    expect(checkTransition(PAYMENT_TRANSITIONS, "PENDING", "FAILED").allowed).toBe(true);
  });

  it("FAILED حالت پایانی است — گذار خروجی ندارد", () => {
    expect(checkTransition(PAYMENT_TRANSITIONS, "FAILED", "PAID").allowed).toBe(false);
    expect(checkTransition(PAYMENT_TRANSITIONS, "FAILED", "PENDING").allowed).toBe(false);
  });

  it("مسیر refund کامل و جزئی", () => {
    expect(checkTransition(PAYMENT_TRANSITIONS, "PAID", "REFUNDED").allowed).toBe(true);
    expect(checkTransition(PAYMENT_TRANSITIONS, "PAID", "PARTIALLY_REFUNDED").allowed).toBe(true);
    expect(checkTransition(PAYMENT_TRANSITIONS, "PARTIALLY_REFUNDED", "REFUNDED").allowed).toBe(true);
    expect(checkTransition(PAYMENT_TRANSITIONS, "REFUNDED", "PAID").allowed).toBe(false);
  });
});

describe("Shipment · Reservation · Refund · Review · Content", () => {
  it("Shipment مسیر خطی + FAILED → RETURNED", () => {
    expect(checkTransition(SHIPMENT_TRANSITIONS, "PENDING", "READY").allowed).toBe(true);
    expect(checkTransition(SHIPMENT_TRANSITIONS, "READY", "SHIPPED").allowed).toBe(true);
    expect(checkTransition(SHIPMENT_TRANSITIONS, "SHIPPED", "IN_TRANSIT").allowed).toBe(true);
    expect(checkTransition(SHIPMENT_TRANSITIONS, "IN_TRANSIT", "DELIVERED").allowed).toBe(true);
    expect(checkTransition(SHIPMENT_TRANSITIONS, "SHIPPED", "FAILED").allowed).toBe(true);
    expect(checkTransition(SHIPMENT_TRANSITIONS, "FAILED", "RETURNED").allowed).toBe(true);
    expect(checkTransition(SHIPMENT_TRANSITIONS, "DELIVERED", "FAILED").allowed).toBe(false);
  });

  it("Reservation فقط از ACTIVE خروج دارد", () => {
    expect(checkTransition(RESERVATION_TRANSITIONS, "ACTIVE", "CONVERTED").allowed).toBe(true);
    expect(checkTransition(RESERVATION_TRANSITIONS, "ACTIVE", "RELEASED").allowed).toBe(true);
    expect(checkTransition(RESERVATION_TRANSITIONS, "ACTIVE", "EXPIRED").allowed).toBe(true);
    expect(checkTransition(RESERVATION_TRANSITIONS, "EXPIRED", "ACTIVE").allowed).toBe(false);
  });

  it("Refund: REQUESTED → PROCESSING → SUCCEEDED|FAILED", () => {
    expect(checkTransition(REFUND_TRANSITIONS, "REQUESTED", "PROCESSING").allowed).toBe(true);
    expect(checkTransition(REFUND_TRANSITIONS, "PROCESSING", "SUCCEEDED").allowed).toBe(true);
    expect(checkTransition(REFUND_TRANSITIONS, "PROCESSING", "FAILED").allowed).toBe(true);
    expect(checkTransition(REFUND_TRANSITIONS, "REQUESTED", "SUCCEEDED").allowed).toBe(false);
  });

  it("Review: فقط PENDING → APPROVED|REJECTED", () => {
    expect(checkTransition(REVIEW_TRANSITIONS, "PENDING", "APPROVED").allowed).toBe(true);
    expect(checkTransition(REVIEW_TRANSITIONS, "PENDING", "REJECTED").allowed).toBe(true);
    expect(checkTransition(REVIEW_TRANSITIONS, "APPROVED", "REJECTED").allowed).toBe(false);
  });

  it("Content: DRAFT هرگز مستقیم ARCHIVED نمی‌شود", () => {
    expect(checkTransition(CONTENT_TRANSITIONS, "DRAFT", "PUBLISHED").allowed).toBe(true);
    expect(checkTransition(CONTENT_TRANSITIONS, "PUBLISHED", "ARCHIVED").allowed).toBe(true);
    expect(checkTransition(CONTENT_TRANSITIONS, "DRAFT", "ARCHIVED").allowed).toBe(false);
  });
});
