/**
 * Store name helper — نام برند برای قالب پیامک‌ها (M5)
 * خواندن از Setting دیتابیس؛ هر خطا = fallback ایمن (worker هرگز نباید بشکند).
 */

import { db } from "@/lib/db";
import { storeConfig } from "@/lib/config";

let cachedName: { value: string; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

/** نام برند زنده از DB — TTL ۵ دقیقه؛ خطا = پیش‌فرض seed (بدون throw) */
export async function getStoreNameSafe(): Promise<string> {
  if (cachedName && Date.now() - cachedName.at < TTL_MS) return cachedName.value;
  try {
    const row = await db.setting.findUnique({
      where: { key: "store.config" },
      select: { value: true },
    });
    const name = (row?.value as { brandName?: string } | null)?.brandName?.trim();
    const value = name || storeConfig.brandName;
    cachedName = { value, at: Date.now() };
    return value;
  } catch {
    return storeConfig.brandName;
  }
}

export const getStoreConfigSafe = getStoreNameSafe;
