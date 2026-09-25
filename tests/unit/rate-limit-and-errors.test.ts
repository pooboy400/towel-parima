import { describe, expect, it } from "bun:test";
import { InMemoryRateLimiter } from "../../src/core/rate-limit/in-memory";
import { RATE_RULES, rateKey } from "../../src/core/rate-limit/policies";
import { DomainError, toErrorBody } from "../../src/core/errors";

describe("InMemoryRateLimiter — پنجره لغزان", () => {
  it("تا سقف مجاز است، بعدش رد می‌کند", async () => {
    const limiter = new InMemoryRateLimiter();
    const rule = { limit: 3, windowMs: 60_000 };

    expect((await limiter.hit("k1", rule)).ok).toBe(true);
    expect((await limiter.hit("k1", rule)).ok).toBe(true);
    const third = await limiter.hit("k1", rule);
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = await limiter.hit("k1", rule);
    expect(fourth.ok).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
    limiter.dispose();
  });

  it("کلیدهای جدا سهمیه جدا دارند", async () => {
    const limiter = new InMemoryRateLimiter();
    const rule = { limit: 1, windowMs: 60_000 };
    expect((await limiter.hit("a", rule)).ok).toBe(true);
    expect((await limiter.hit("b", rule)).ok).toBe(true);
    expect((await limiter.hit("a", rule)).ok).toBe(false);
    limiter.dispose();
  });

  it("پنجره لغزان: بعد از گذر زمان دوباره باز می‌شود", async () => {
    const limiter = new InMemoryRateLimiter();
    const rule = { limit: 1, windowMs: 50 };
    expect((await limiter.hit("t", rule)).ok).toBe(true);
    expect((await limiter.hit("t", rule)).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect((await limiter.hit("t", rule)).ok).toBe(true);
    limiter.dispose();
  });

  it("peek بدون مصرف است", async () => {
    const limiter = new InMemoryRateLimiter();
    const rule = { limit: 2, windowMs: 60_000 };
    await limiter.hit("p", rule);
    const before = await limiter.peek("p", rule);
    expect(before.remaining).toBe(1);
    const after = await limiter.peek("p", rule);
    expect(after.remaining).toBe(1);
    limiter.dispose();
  });

  it("reset سهمیه را آزاد می‌کند", async () => {
    const limiter = new InMemoryRateLimiter();
    const rule = { limit: 1, windowMs: 60_000 };
    await limiter.hit("r", rule);
    expect((await limiter.hit("r", rule)).ok).toBe(false);
    await limiter.reset("r");
    expect((await limiter.hit("r", rule)).ok).toBe(true);
    limiter.dispose();
  });
});

describe("جدول سقف‌ها — مطابقت با بخش ۹.۴ سند", () => {
  it("مقادیر کانونی", () => {
    expect(RATE_RULES.otpSendPerPhone).toEqual({ limit: 3, windowMs: 600_000 });
    expect(RATE_RULES.otpSendPerIp).toEqual({ limit: 10, windowMs: 3_600_000 });
    expect(RATE_RULES.otpVerifyPerPhone).toEqual({ limit: 5, windowMs: 900_000 });
    expect(RATE_RULES.signIn).toEqual({ limit: 5, windowMs: 900_000 });
    expect(RATE_RULES.paymentStart).toEqual({ limit: 5, windowMs: 600_000 });
    expect(RATE_RULES.couponApply).toEqual({ limit: 10, windowMs: 600_000 });
    expect(RATE_RULES.reviewSubmit).toEqual({ limit: 3, windowMs: 86_400_000 });
    expect(RATE_RULES.search).toEqual({ limit: 30, windowMs: 60_000 });
    expect(RATE_RULES.publicApi).toEqual({ limit: 120, windowMs: 60_000 });
  });

  it("rateKey اجزای undefined را می‌پرد", () => {
    expect(rateKey("otp", "0912", undefined, "1.2.3.4")).toBe("otp:0912:1.2.3.4");
  });
});

describe("استاندارد خطا — بخش ۲۴ سند", () => {
  it("toErrorBody شکل استاندارد بدون stack می‌سازد", () => {
    const err = new DomainError("OUT_OF_STOCK", "موجودی کافی نیست.", undefined, {
      variantId: "v1",
    });
    const body = toErrorBody(err);
    expect(body.error.code).toBe("OUT_OF_STOCK");
    expect(body.error.message).toBe("موجودی کافی نیست.");
    expect(body.error.meta).toEqual({ variantId: "v1" });
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("نگاشت پیش‌فرض کد → HTTP درست است", () => {
    expect(new DomainError("VALIDATION_ERROR", "x").status).toBe(400);
    expect(new DomainError("UNAUTHENTICATED", "x").status).toBe(401);
    expect(new DomainError("FORBIDDEN", "x").status).toBe(403);
    expect(new DomainError("NOT_FOUND", "x").status).toBe(404);
    expect(new DomainError("COUPON_INVALID", "x").status).toBe(422);
    expect(new DomainError("RATE_LIMITED", "x").status).toBe(429);
    expect(new DomainError("INTERNAL", "x").status).toBe(500);
  });

  it("override status کار می‌کند (مثل verify → 409)", () => {
    expect(new DomainError("PAYMENT_VERIFY_FAILED", "x", 409).status).toBe(409);
  });
});
