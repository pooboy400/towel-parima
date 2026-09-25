/**
 * Cache — سیاست کش خواندن سرویس‌ها (بخش ۱۶ سند)
 * ---------------------------------------------------------------
 * - خواندنی‌های پایدار کاتالوگ/محتوا: unstable_cache + tagهای entity-aware
 *   تا mutationهای M2 با revalidateTag(CACHE_TAGS.*) بی‌درنگ بی‌اعتبار کنند.
 * - طبق ۱۶.۲ هرگز کش نمی‌شوند: /shop (searchParams)، جستجو، سبد،
 *   حساب کاربری، همه API Routeها و هر پاسخ user-specific.
 * - کش صفحه (ISR revalidate=3600) در خود pageها سر جایش است.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/core/cache";

/** TTL سرویس‌محور — هم‌تراز ISR صفحات */
const SERVICE_REVALIDATE = 3600;

export function cachedRead<T>(
  fn: () => Promise<T>,
  keyParts: readonly string[],
  tags: readonly string[],
): Promise<T> {
  const cached = unstable_cache(fn, [...keyParts], {
    tags: [...tags],
    revalidate: SERVICE_REVALIDATE,
  });
  return cached();
}
