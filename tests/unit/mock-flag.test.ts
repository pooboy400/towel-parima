import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { allowMocksInProduction } from "../../src/core/env";
import { MockPaymentProvider } from "../../src/providers/payment/mock-payment";
import { MockSmsProvider } from "../../src/providers/sms/mock-sms";
import { DomainError } from "../../src/core/errors";

/**
 * ALLOW_MOCKS_IN_PRODUCTION — قفل صریح دمو در بیلد production
 * پیش‌فرض: mock در production قفل کامل (حتی startPayment).
 * با فلگ=1: همه مسیرها باز (دموی staging).
 */

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_FLAG = process.env.ALLOW_MOCKS_IN_PRODUCTION;

describe("allowMocksInProduction", () => {
  beforeEach(() => {
    delete process.env.ALLOW_MOCKS_IN_PRODUCTION;
  });
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (ORIGINAL_FLAG === undefined) delete process.env.ALLOW_MOCKS_IN_PRODUCTION;
    else process.env.ALLOW_MOCKS_IN_PRODUCTION = ORIGINAL_FLAG;
  });

  it("پیش‌فرض: false — هر مقداری جز رشته‌ی دقیق '1'", () => {
    process.env.ALLOW_MOCKS_IN_PRODUCTION = "0";
    expect(allowMocksInProduction()).toBe(false);
    process.env.ALLOW_MOCKS_IN_PRODUCTION = "true";
    expect(allowMocksInProduction()).toBe(false);
    delete process.env.ALLOW_MOCKS_IN_PRODUCTION;
    expect(allowMocksInProduction()).toBe(false);
  });

  it("فلگ صریح = true", () => {
    process.env.ALLOW_MOCKS_IN_PRODUCTION = "1";
    expect(allowMocksInProduction()).toBe(true);
  });

  it("در production بدون فلگ: startPayment/verify/refund همگی throw", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_MOCKS_IN_PRODUCTION;
    const pay = new MockPaymentProvider();
    const order = {
      id: "t1", code: "T1", grandTotal: 1000, currency: "IRT" as const,
      callbackUrl: "/cb", description: "test",
    };
    await expect(pay.startPayment(order)).rejects.toBeInstanceOf(DomainError);
    await expect(pay.verifyPayment({ authority: "MOCK-x", amountIrt: 1000 })).rejects.toBeInstanceOf(DomainError);
    await expect(pay.refundPayment({ transactionId: "MOCKTX-x", amountIrt: 1000 })).rejects.toBeInstanceOf(DomainError);
  });

  it("در production با فلگ: مسیر کامل mock کار می‌کند", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_MOCKS_IN_PRODUCTION = "1";
    const pay = new MockPaymentProvider();
    const order = {
      id: "t2", code: "T2", grandTotal: 2000, currency: "IRT" as const,
      callbackUrl: "/cb", description: "test",
    };
    const start = await pay.startPayment(order);
    expect(start.authority.startsWith("MOCK-")).toBe(true);
    expect(start.redirectUrl).toContain("/mock-gateway?authority=");
    const verify = await pay.verifyPayment({ authority: start.authority, amountIrt: 2000 });
    expect(verify.ok).toBe(true);
    const refund = await pay.refundPayment({ transactionId: "MOCKTX-1", amountIrt: 2000 });
    expect(refund.ok).toBe(true);
  });

  it("در production بدون فلگ: sms mock هم throw", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_MOCKS_IN_PRODUCTION;
    const sms = new MockSmsProvider();
    await expect(sms.send({ to: "09120000000", text: "x" })).rejects.toBeInstanceOf(DomainError);
  });

  it("در production با فلگ: sms mock ارسال می‌کند", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_MOCKS_IN_PRODUCTION = "1";
    const sms = new MockSmsProvider();
    const res = await sms.send({ to: "09120000000", text: "x", tag: "test" });
    expect(res.ok).toBe(true);
    expect(res.providerId?.startsWith("mock-")).toBe(true);
  });

  it("در development بدون فلگ: همه چیز آزاد (رفتار قدیمی حفظ شود)", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_MOCKS_IN_PRODUCTION;
    const pay = new MockPaymentProvider();
    const order = {
      id: "t3", code: "T3", grandTotal: 500, currency: "IRT" as const,
      callbackUrl: "/cb", description: "test",
    };
    const start = await pay.startPayment(order);
    expect(start.authority.startsWith("MOCK-")).toBe(true);
  });
});
