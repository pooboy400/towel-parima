/**
 * Settings Service — خواندن تایپ‌شده از جدول Setting (بخش ۱۸ سند)
 * ---------------------------------------------------------------
 * قاعده سند: UI هرگز JSON خام نمی‌بیند؛ هر خواندن Zod parse می‌شود.
 * اسکیماها در domain/schemas/settings.ts (تست‌پذیر بدون سرور).
 * مقادیر پیش‌فرض از lib/config.ts — اگر Setting در دیتابیس نبود، fallback
 * ایمن برمی‌گردد تا هیچ صفحه‌ای به‌خاطر تنظیمات نشکند.
 */
import "server-only";
import type { z } from "zod";
import {
  storeConfigSchema,
  shippingInfoSchema,
  homeSettingsSchema,
  badgeRulesSchema,
  type StoreConfigV2,
  type ShippingInfoV2,
  type HomeSettingsV2,
  type BadgeRulesV2,
} from "@/domain/schemas/settings";
import { CACHE_TAGS } from "@/core/cache";
import { cachedRead } from "@/lib/cache";
import { contentRepository } from "@/lib/repositories/content-repository";
import { storeConfig, shippingInfo, DEFAULT_BADGE_RULES } from "@/lib/config";

const KNOWN_KEYS = new Set([
  "store.config",
  "store.shipping",
  "home.testimonials",
  "home.featured",
  "store.badgeRules",
] as const);

/** خواندن اعتبارسنجی‌شده — کلید ناشناخته → خطا (strict طبق بخش ۱۸) */
export async function getSetting<T>(
  key: string,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!KNOWN_KEYS.has(key as never)) {
    throw new Error(`کلید Setting ناشناخته است: ${key}`);
  }
  return cachedRead(
    async () => {
      const raw = await contentRepository.getSetting<unknown>(key);
      if (raw === null) {
        throw new Error(`Setting پیدا نشد: ${key}`);
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(`Setting نامعتبر است (${key}): ${parsed.error.message}`);
      }
      return parsed.data;
    },
    ["setting-v1", key],
    [CACHE_TAGS.settings],
  );
}

/** پیکربندی فروشگاه تایپ‌شده — منبع حقیقت نمایش (ادمین از /admin/settings ویرایش می‌کند) */
export async function getStoreConfig(): Promise<StoreConfigV2> {
  return getSetting("store.config", storeConfigSchema);
}

/** قوانین ارسال/مرجوعی تایپ‌شده (store.shipping) */
export async function getShippingInfo(): Promise<ShippingInfoV2> {
  return getSetting("store.shipping", shippingInfoSchema);
}

/** کالکشن ویژهٔ صفحهٔ اصلی (home.featured) */
export async function getHomeSettings(): Promise<HomeSettingsV2> {
  return getSetting("home.featured", homeSettingsSchema);
}

/** قوانین برچسب‌های خودکار (store.badgeRules) — ADR 011 */
export async function getBadgeRules(): Promise<BadgeRulesV2> {
  return getSetting("store.badgeRules", badgeRulesSchema);
}

/**
 * آیا خطا از نوع «Setting در دیتابیس نیست» است؟
 * نبودن Setting وضعیت عادیِ پیش از اولین ذخیرهٔ ادمین است — نه خطا؛
 * پس نباید قرمز لاگ شود (فقط خطاهای واقعی مثل دادهٔ خراب یا خطای DB).
 */
function isSettingNotFound(e: unknown): boolean {
  return e instanceof Error && e.message.includes("Setting پیدا نشد:");
}

/**
 * خواندن ایمن قوانین برچسب — اگر Setting نبود یا نامعتبر بود، پیش‌فرض‌های
 * lib/config برمی‌گردد تا هیچ صفحه‌ای به‌خاطر نبود تنظیم نشکند.
 * نبودن Setting (پیش از اولین ذخیرهٔ ادمین) فقط info است؛ خطای واقعی error.
 */
export async function getBadgeRulesSafe(): Promise<BadgeRulesV2> {
  return getBadgeRules().catch((e) => {
    if (isSettingNotFound(e)) {
      console.info("[settings] store.badgeRules unset yet — using defaults (ADR 011)");
      return DEFAULT_BADGE_RULES;
    }
    console.error("[settings] fallback store.badgeRules:", e instanceof Error ? e.message : e);
    return DEFAULT_BADGE_RULES;
  });
}

/**
 * خواندن ایمن برای UI عمومی — اگر Setting نبود یا نامعتبر بود،
 * پیش‌فرض‌های lib/config.ts برمی‌گردد تا هیچ صفحه‌ای نشکند.
 * (fallback آگاهانه؛ خطاها در لاگ سرور دیده می‌شوند)
 */
export async function getStoreSettingsSafe(): Promise<{
  config: StoreConfigV2;
  shipping: ShippingInfoV2;
}> {
  const [config, shipping] = await Promise.all([
    getStoreConfig().catch((e) => {
      if (!isSettingNotFound(e)) {
        console.error("[settings] fallback store.config:", e instanceof Error ? e.message : e);
      }
      return storeConfig;
    }),
    getShippingInfo().catch((e) => {
      if (!isSettingNotFound(e)) {
        console.error("[settings] fallback store.shipping:", e instanceof Error ? e.message : e);
      }
      return shippingInfo;
    }),
  ]);
  return { config, shipping };
}
