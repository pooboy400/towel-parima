/**
 * Rate Limit — پیاده‌سازی in-memory با پنجره لغزان (sliding window)
 * ---------------------------------------------------------------
 * انتخاب پنجره لغزان به‌جای پنجره ثابت: جلوگیری از burst مرزی
 * (مثلاً ۲ برابر سقف در ثانیه‌های مرزی دو پنجره).
 *
 * کارایی:
 * - هر key فقط یک آرایه timestamp است — O(k) برای hit که k ≤ سقف پنجره است.
 * - پاکسازی تنبل هنگام hit + sweep دوره‌ای برای keyهای مرده (بدون leak).
 * - setInterval با unref تا مانع shutdown پروسه نشود.
 */

/**
 * INFRA-07 (فاز ۶) — ADR: این adapter درون‌حافظه‌ای برای تک‌instance فعلی
 * عمدی است (سریع، بدون وابستگی). در استقرار multi-instance باید پشت همین
 * اینترفیس (rateLimiter) یک adapter Redis قرار بگیرد — هیچ call-site‌ای
 * نباید مستقیم به این فایل import کند؛ همه از "@/core/rate-limit" (index)
 * مصرف می‌کنند تا جابه‌جایی شفاف باشد.
 */

import type { RateLimitResult, RateLimitRule, RateLimiter } from "./types";

const MAX_BUCKETS = 100_000; // سقف حافظه — در حمله، کلیدهای قدیمی دور ریخته می‌شوند

export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, number[]>();
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(private defaultTtlMs = 3_600_000) {}

  async hit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - rule.windowMs;

    let stamps = this.buckets.get(key);
    if (stamps) {
      // دور ریختن timestampهای خارج پنجره — پاکسازی تنبل
      let start = 0;
      while (start < stamps.length && stamps[start] <= windowStart) start++;
      if (start > 0) stamps = stamps.slice(start);
    } else {
      stamps = [];
    }

    if (stamps.length >= rule.limit) {
      const oldest = stamps[0];
      this.buckets.set(key, stamps);
      this.ensureSweeper();
      return {
        ok: false,
        remaining: 0,
        retryAfterMs: oldest + rule.windowMs - now,
      };
    }

    stamps.push(now);

    // حفاظت حافظه — سقف کلیدها
    if (this.buckets.size > MAX_BUCKETS) {
      const drop = this.buckets.size - MAX_BUCKETS;
      const iter = this.buckets.keys();
      for (let i = 0; i < drop; i++) {
        const k = iter.next();
        if (k.done) break;
        this.buckets.delete(k.value);
      }
    }

    this.buckets.set(key, stamps);
    this.ensureSweeper();
    return {
      ok: true,
      remaining: rule.limit - stamps.length,
      retryAfterMs: 0,
    };
  }

  async peek(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - rule.windowMs;
    const stamps = this.buckets.get(key) ?? [];
    let active = 0;
    for (const t of stamps) if (t > windowStart) active++;
    if (active >= rule.limit) {
      const oldest = stamps.find((t) => t > windowStart) ?? now;
      return { ok: false, remaining: 0, retryAfterMs: oldest + rule.windowMs - now };
    }
    return { ok: true, remaining: rule.limit - active, retryAfterMs: 0 };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  /** sweep دوره‌ای: حذف bucketهایی که آخرین timestampشان از TTL گذشته */
  private ensureSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      const cutoff = Date.now() - this.defaultTtlMs;
      for (const [key, stamps] of this.buckets) {
        const last = stamps[stamps.length - 1];
        if (last === undefined || last <= cutoff) this.buckets.delete(key);
      }
    }, 60_000);
    // مانع نگه‌داشتن پروسه به‌خاطر تایمر نباشیم
    this.sweeper.unref?.();
  }

  /** برای تسته‌ها */
  dispose(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    this.buckets.clear();
  }
}

/** نمونه singleton سرور — همه Actionها و Routes از این استفاده می‌کنند */
export const rateLimiter = new InMemoryRateLimiter();
