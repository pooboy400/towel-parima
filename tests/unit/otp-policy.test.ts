import { describe, expect, it } from "bun:test";
import {
  generateOtpCode,
  hashOtpCode,
  isValidIranMobile,
  normalizePhone,
  OTP_POLICY,
  timingSafeEqual,
  verifyOtpAttempt,
} from "../../src/domain/policies/otp";

describe("normalizePhone", () => {
  it("قالب‌های رایج به 09xxxxxxxxx می‌رسند", () => {
    expect(normalizePhone("09121234567")).toBe("09121234567");
    expect(normalizePhone("+98 912 123 4567")).toBe("09121234567");
    expect(normalizePhone("00989121234567")).toBe("09121234567");
    expect(normalizePhone("۹۸۹۱۲۱۲۳۴۵۶۷")).toBe("09121234567");
    expect(normalizePhone("۰۹۱۲-۱۲۳-۴۵۶۷")).toBe("09121234567");
  });

  it("شماره نامعتبر همان دigitهای تمیز را برمی‌گرداند", () => {
    expect(isValidIranMobile("12345")).toBe(false);
    expect(isValidIranMobile("0912123456")).toBe(false);
    expect(isValidIranMobile("+98 912 123 4567")).toBe(true);
  });
});

describe("generateOtpCode + hash", () => {
  it("کد ۶ رقمی عددی تولید می‌کند", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hash پایدار و حساس به کد است", async () => {
    const a = await hashOtpCode("123456");
    const b = await hashOtpCode("123456");
    const c = await hashOtpCode("654321");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyOtpAttempt — سیاست بخش ۹.۴ سند", () => {
  const now = new Date();
  const future = new Date(now.getTime() + OTP_POLICY.ttlMs);
  const past = new Date(now.getTime() - 1000);

  interface TestRecord {
    code: string;
    hash: string;
    expiresAt: Date;
    attemptCount: number;
    usedAt: Date | null;
  }

  async function makeRecord(
    overrides?: Partial<{ code: string; expiresAt: Date; attemptCount: number; usedAt: Date | null }>,
  ): Promise<TestRecord> {
    const code = overrides?.code ?? "123456";
    return {
      code,
      hash: await hashOtpCode(code),
      expiresAt: overrides?.expiresAt ?? future,
      attemptCount: overrides?.attemptCount ?? 0,
      usedAt: overrides?.usedAt ?? null,
    };
  }

  it("کد درست → ok", async () => {
    const r = await makeRecord();
    const res = verifyOtpAttempt(
      { codeHash: r.hash, expiresAt: r.expiresAt, attemptCount: 0, usedAt: null },
      r.code,
      await hashOtpCode(r.code),
    );
    expect(res.ok).toBe(true);
  });

  it("کد اشتباه → MISMATCH با attemptsLeft", async () => {
    const r = await makeRecord();
    const res = verifyOtpAttempt(
      { codeHash: r.hash, expiresAt: r.expiresAt, attemptCount: 0, usedAt: null },
      "000000",
      await hashOtpCode("000000"),
    );
    expect(res.ok).toBe(false);
    expect(res.failure).toBe("MISMATCH");
    expect(res.attemptsLeft).toBe(OTP_POLICY.maxAttempts - 1);
  });

  it("کد منقضی → EXPIRED حتی اگر کد درست باشد", async () => {
    const r = await makeRecord({ expiresAt: past });
    const res = verifyOtpAttempt(
      { codeHash: r.hash, expiresAt: r.expiresAt, attemptCount: 0, usedAt: null },
      r.code,
      await hashOtpCode(r.code),
    );
    expect(res.ok).toBe(false);
    expect(res.failure).toBe("EXPIRED");
  });

  it("کد مصرف‌شده → ALREADY_USED (مصرف یک‌بار)", async () => {
    const r = await makeRecord({ usedAt: now });
    const res = verifyOtpAttempt(
      { codeHash: r.hash, expiresAt: r.expiresAt, attemptCount: 0, usedAt: r.usedAt },
      r.code,
      await hashOtpCode(r.code),
    );
    expect(res.failure).toBe("ALREADY_USED");
  });

  it("سقف ۵ تلاش → TOO_MANY_ATTEMPTS", async () => {
    const r = await makeRecord({ attemptCount: 5 });
    const res = verifyOtpAttempt(
      { codeHash: r.hash, expiresAt: r.expiresAt, attemptCount: r.attemptCount, usedAt: null },
      r.code,
      await hashOtpCode(r.code),
    );
    expect(res.failure).toBe("TOO_MANY_ATTEMPTS");
  });

  it("در تلاش پنجم (4 تلاش قبل) هنوز بررسی می‌شود", async () => {
    const r = await makeRecord({ attemptCount: 4 });
    const ok = verifyOtpAttempt(
      { codeHash: r.hash, expiresAt: r.expiresAt, attemptCount: 4, usedAt: null },
      r.code,
      await hashOtpCode(r.code),
    );
    expect(ok.ok).toBe(true);
  });
});

describe("timingSafeEqual", () => {
  it("رشته‌های برابر true و نامساوی false", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
