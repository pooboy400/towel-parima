/**
 * BestsellerService — گزارش «پرفروش‌های خودکار» برای ادمین (ADR 011 / بخش ۴.۲.۱)
 * ---------------------------------------------------------------
 * قرار جدید مالک: برچسب «پرفروش» خودش زده می‌شود (badge-service) و دیگر
 * تأیید ادمین ندارد. این سرویس فقط «گزارش شفاف» می‌سازد تا مالک ببیند
 * سیستم چه چیزی را پرفروش تشخیص داده — رتبه‌بندی از تجمیع OrderItem
 * سفارش‌های پرداخت‌شده (PROCESSING/SHIPPED/DELIVERED) در پنجرهٔ زمانی.
 * هیچ عددی سفت نیست؛ آستانه و پنجره از store.badgeRules می‌آید.
 */

import { db } from "@/lib/db";
import { getBadgeRulesSafe } from "@/services/settings-service";

/** وضعیت‌هایی که فروش محسوب می‌شوند — سفارش پرداخت‌شدهٔ لغونشده */
const SOLD_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED"] as const;

export interface BestsellerReportItem {
  productId: string;
  name: string;
  slug: string;
  /** فروش واقعی (تعداد) در پنجرهٔ زمانی */
  soldQty: number;
  /** برچسب خودکار فعال است؟ (soldQty ≥ حد قوانین) */
  badgeActive: boolean;
}

export interface BestsellerReport {
  windowDays: number;
  minSales: number;
  items: BestsellerReportItem[];
}

/** گزارش پرفروش‌های خودکار — نمایشی/اطلاع‌رسان؛ هیچ mutation ندارد */
export async function getBestsellerReport(
  opts: { limit?: number } = {},
): Promise<BestsellerReport> {
  const rules = await getBadgeRulesSafe();
  const limit = opts.limit ?? 3;
  const since = new Date(Date.now() - rules.bestsellerWindowDays * 24 * 60 * 60 * 1000);

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
    orderBy: { _sum: { quantity: "desc" } },
    take: limit * 2, // برای فیلتر محصول حذف‌شده فضای اضافه
  });

  if (grouped.length === 0) {
    return {
      windowDays: rules.bestsellerWindowDays,
      minSales: rules.bestsellerMinSales,
      items: [],
    };
  }

  const products = await db.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) }, deletedAt: null },
    select: { id: true, name: true, slug: true },
  });

  const items = grouped
    .map((g) => {
      const p = products.find((x) => x.id === g.productId);
      if (!p) return null;
      const soldQty = g._sum.quantity ?? 0;
      return {
        productId: p.id,
        name: p.name,
        slug: p.slug,
        soldQty,
        badgeActive: soldQty >= rules.bestsellerMinSales,
      } satisfies BestsellerReportItem;
    })
    .filter((x): x is BestsellerReportItem => x !== null)
    .sort((a, b) => b.soldQty - a.soldQty)
    .slice(0, limit);

  return {
    windowDays: rules.bestsellerWindowDays,
    minSales: rules.bestsellerMinSales,
    items,
  };
}
