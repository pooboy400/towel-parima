/**
 * BadgeService — برچسب‌های خودکار (ADR 011 — نسخهٔ بازنگری‌شدهٔ بخش ۴.۲.۱ سند)
 * ---------------------------------------------------------------
 * قرار جدید مالک: برچسب‌ها دیگر هیچ‌وقت با دست زده نمی‌شوند — همیشه از روی
 * دادهٔ واقعی محاسبه می‌شوند:
 *
 *   «جدید»      → کمتر از newDays روز از createdAt محصول گذشته باشد
 *   «پرفروش»    → فروش پرداخت‌شدهٔ واقعی ≥ bestsellerMinSales در پنجرهٔ bestsellerWindowDays
 *                 (سفارش‌های PROCESSING/SHIPPED/DELIVERED؛ مرجوع کامل فروش نیست)
 *   «محدود»     → موجودی آزاد بین ۱ تا limitedMaxStock
 *   «تخفیف»     → از قبل محاسبهٔ زندهٔ UI است (درصد از compareAtPrice > price)
 *
 * آستانه‌ها از Setting «store.badgeRules» می‌آیند (قابل تغییر از /admin/settings)
 * با fallback ایمن به DEFAULT_BADGE_RULES. ترتیب اهمیت نمایش:
 *   پرفروش > جدید > محدود — کارت محصول حداکثر ۲ برچسب نشان می‌دهد.
 *
 * Repository بعد از mapProductToDomain این تابع را صدا می‌زند تا badges پر شود.
 */

import { db } from "@/lib/db";
import { getBadgeRulesSafe } from "@/services/settings-service";
import type { BadgeRulesV2 } from "@/domain/schemas/settings";
import type { BadgeType } from "@/domain/models";

/** وضعیت‌هایی که فروش محسوب می‌شوند — سفارش پرداخت‌شدهٔ لغونشده */
const SOLD_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BadgeRuleContext {
  rules: BadgeRulesV2;
  /** فروش واقعی هر محصول (productId → تعداد) در پنجرهٔ زمانی قوانین */
  bestsellerQty: Map<string, number>;
}

/** یک‌بار در هر خواندنِ لیست/تک محصول: قوانین + نقشهٔ فروش واقعی */
export async function getBadgeRuleContext(): Promise<BadgeRuleContext> {
  const rules = await getBadgeRulesSafe();
  const since = new Date(Date.now() - rules.bestsellerWindowDays * DAY_MS);

  const grouped = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        status: { in: [...SOLD_STATUSES] },
        placedAt: { gte: since },
        // سفارش با استرداد کامل فروش نیست — از شمارش حذف می‌شود
        payments: { none: { status: "REFUNDED" } },
      },
    },
    _sum: { quantity: true },
  });

  return {
    rules,
    bestsellerQty: new Map(grouped.map((g) => [g.productId, g._sum.quantity ?? 0])),
  };
}

/**
 * محاسبهٔ خالص برچسب‌های یک محصول از روی داده — تست‌پذیر بدون دیتابیس.
 * ترتیب خروجی = ترتیب اهمیت نمایش: پرفروش، جدید، محدود.
 */
export function computeAutoBadges(
  input: { createdAt: Date | string; stock: number; soldQty: number },
  rules: BadgeRulesV2,
): BadgeType[] {
  const badges: BadgeType[] = [];
  if (input.soldQty >= rules.bestsellerMinSales) badges.push("bestseller");

  const createdAt =
    typeof input.createdAt === "string" ? new Date(input.createdAt) : input.createdAt;
  const ageDays = (Date.now() - createdAt.getTime()) / DAY_MS;
  if (ageDays <= rules.newDays) badges.push("new");

  if (input.stock > 0 && input.stock <= rules.limitedMaxStock) badges.push("limited");

  return badges;
}

/** شکل minimal که attach به آن نیاز دارد — Product دامنه آن را برآورده می‌کند */
export interface BadgeAttachable {
  id: string;
  createdAt: string;
  stock: number;
  badges: BadgeType[];
}

/**
 * پرکردن badges مدل دامنه — تنها نقطهٔ صدق برچسب‌ها در خواندن.
 * Repository بعد از mapProductToDomain صدا می‌زند (تک و لیست).
 */
export async function attachAutoBadges<T extends BadgeAttachable>(items: T[]): Promise<T[]> {
  if (items.length === 0) return items;
  const ctx = await getBadgeRuleContext();
  for (const p of items) {
    p.badges = computeAutoBadges(
      { createdAt: p.createdAt, stock: p.stock, soldQty: ctx.bestsellerQty.get(p.id) ?? 0 },
      ctx.rules,
    );
  }
  return items;
}
