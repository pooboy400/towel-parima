import { describe, expect, it } from "bun:test";
import {
  isIdleExpired,
  isSessionValid,
  newSessionExpiry,
  SESSION_POLICY,
} from "../../src/domain/policies/session";

describe("Session policy — بخش ۹.۳ سند", () => {
  const now = new Date("2026-01-15T10:00:00Z");

  it("مشتری: انقضا دقیقاً ۳۰ روز بعد", () => {
    const exp = newSessionExpiry(false, now);
    const expectedMs = 30 * 24 * 60 * 60_000;
    expect(exp.getTime() - now.getTime()).toBe(expectedMs);
  });

  it("ادمین: انقضای مطلق ۸ ساعت", () => {
    const exp = newSessionExpiry(true, now);
    expect(exp.getTime() - now.getTime()).toBe(8 * 60 * 60_000);
  });

  it("idle ادمین بعد از ۳۰ دقیقه منقضی می‌شود", () => {
    const idleAt29min = new Date(now.getTime() - 29 * 60_000);
    const idleAt31min = new Date(now.getTime() - 31 * 60_000);
    expect(isIdleExpired(idleAt29min, now)).toBe(false);
    expect(isIdleExpired(idleAt31min, now)).toBe(true);
  });

  it("مشتری idle-timeout ندارد", () => {
    // برای session مشتری isIdleExpired اصلاً بررسی نمی‌شود — فقط ادمین
    const session = {
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: null,
      isAdminSession: false,
      idleAt: new Date(now.getTime() - 10 * 60 * 60_000), // ۱۰ ساعت قبل!
    };
    expect(isSessionValid(session, now)).toBe(true);
  });

  it("revoked session نامعتبر است", () => {
    const session = {
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: new Date(now.getTime() - 1000),
      isAdminSession: false,
      idleAt: null,
    };
    expect(isSessionValid(session, now)).toBe(false);
  });

  it("session منقضی نامعتبر است", () => {
    const session = {
      expiresAt: new Date(now.getTime() - 1),
      revokedAt: null,
      isAdminSession: false,
      idleAt: null,
    };
    expect(isSessionValid(session, now)).toBe(false);
  });

  it("ادمین با idle طولانی نامعتبر است حتی اگر مطلق معتبر باشد", () => {
    const session = {
      expiresAt: new Date(now.getTime() + 4 * 60 * 60_000),
      revokedAt: null,
      isAdminSession: true,
      idleAt: new Date(now.getTime() - 45 * 60_000),
    };
    expect(isSessionValid(session, now)).toBe(false);
  });
});
