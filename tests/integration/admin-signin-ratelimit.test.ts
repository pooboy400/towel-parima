/**
 * Integration — سقف مستقل per-email برای ورود ادمین (SEC-03)
 * دقیقاً همان کلید/قاعده‌ای که adminLoginAction مصرف می‌کند:
 * ۱۰ تلاش/ساعت per email — مستقل از IP؛ با چرخش IP/XFF هم قفل می‌شود.
 */
import { describe, expect, it } from "bun:test";
import { rateLimiter, RATE_RULES, rateKey } from "../../src/core/rate-limit";

const EMAIL = "sec03-victim@prima.test";

describe("admin-signin per-email rate limit (SEC-03)", () => {
  it("۱۰ تلاش (حتی با فرض چرخش IP) → یازدهمی قفل — کلید per-email است (CR-9)", async () => {
    await rateLimiter.reset(rateKey("admin-signin-email", EMAIL));

    // نکتهٔ صادقانه (CR-9/55-c): کلید این سقف فقط ایمیل است و IP ذاتاً در آن
    // دخیل نیست؛ معنای عملیاتی «مستقل از IP» همین است که حتی با چرخش IP/XFF
    // هم کلید مشترک per-email پر می‌شود. اثبات ترتیب واقعی گیت‌ها روی اکشن:
    // اثبات زندهٔ 55-a (تلاش ۱۱ = RATE_LIMITED با retryAfter=60min + audit
    // scope=per-email) — تست سطح اکشن به‌دلیل وابستگی next/headers اینجا ممکن نیست.
    for (let i = 0; i < 10; i++) {
      const rl = await rateLimiter.hit(
        rateKey("admin-signin-email", EMAIL),
        RATE_RULES.signInPerEmail,
      );
      expect(rl.ok).toBe(true);
    }

    // تلاش یازدهم — حتی با IP تازه — باید قفل شود
    const blocked = await rateLimiter.hit(
      rateKey("admin-signin-email", EMAIL),
      RATE_RULES.signInPerEmail,
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);

    // ایمیل دیگر از همان IPها آزاد است (سقف per-email است نه global)
    const otherEmail = await rateLimiter.hit(
      rateKey("admin-signin-email", "sec03-other@prima.test"),
      RATE_RULES.signInPerEmail,
    );
    expect(otherEmail.ok).toBe(true);

    await rateLimiter.reset(rateKey("admin-signin-email", EMAIL));
    await rateLimiter.reset(rateKey("admin-signin-email", "sec03-other@prima.test"));
  }, 20_000);
});
