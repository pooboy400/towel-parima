/**
 * Rate Limit — abstraction واحد (بخش ۹.۴ سند معماری)
 * ---------------------------------------------------------------
 * پیاده‌سازی v1: in-memory (تک‌نود) — sliding window با پاکسازی تنبل.
 * ارتقای آینده (Redis) فقط این فایل را جایگزین می‌کند؛ امضا ثابت است.
 *
 * ⚠️ محدودیت شناخته‌شده v1: با چند replica شمارنده‌ها local هستند؛
 * محیط فعلی تک‌نود است — در M6 با استقرار نهایی بررسی می‌شود.
 */

export interface RateLimitRule {
  /** حداکثر مجاز در پنجره */
  limit: number;
  /** طول پنجره به میلی‌ثانیه */
  windowMs: number;
}

export interface RateLimitResult {
  /** آیا مجاز است */
  ok: boolean;
  /** باقی‌مانده در این پنجره */
  remaining: number;
  /** میلی‌ثانیه تا reset پنجره — برای Retry-After */
  retryAfterMs: number;
}

export interface RateLimiter {
  /**
   * مصرف یک واحد از سهمیه key.
   * ok=false یعنی سقف پر است و درخواست باید با RATE_LIMITED رد شود.
   */
  hit(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
  /** فقط خواندن — بدون مصرف (برای UI و هدرها) */
  peek(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
  /** ریست دستی — برای تسته‌ها و unlock ادمینی */
  reset(key: string): Promise<void>;
}
