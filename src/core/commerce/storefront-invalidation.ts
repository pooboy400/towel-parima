/**
 * Storefront Invalidation — به‌روزرسانی ویترین پس از تغییرات فروش/موجودی
 * ---------------------------------------------------------------
 * برچسب‌های خودکار (ADR 011) و موجودی نمایشیِ کارت محصول از دادهٔ زندهٔ
 * سفارش/رزرو محاسبه می‌شوند؛ پس هر تغییری در زنجیرهٔ فروش باید صفحات
 * ISR محصول/خانه را زودتر از پنجرهٔ revalidate تازه کند.
 * فقط tagهای کانونی — قرارداد بخش ۱۶.۱ سند.
 */

import { db } from "@/lib/db";
import { CACHE_TAGS, productInvalidationTags, revalidateEntityTag } from "@/core/cache";

export async function invalidateStorefrontForProducts(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (ids.length === 0) return;
  for (const id of ids) {
    for (const tag of productInvalidationTags(id, { onHomepage: true })) {
      revalidateEntityTag(tag);
    }
  }
  revalidateEntityTag(CACHE_TAGS.products);
}

/** پس از placeOrder / confirmPayment / failPayment / cancelOrder / refund */
export async function invalidateStorefrontForOrder(orderId: string): Promise<void> {
  const items = await db.orderItem.findMany({
    where: { orderId },
    select: { productId: true },
  });
  await invalidateStorefrontForProducts(items.map((i) => i.productId));
}

/** پس از آزادسازی/تبدیل رزروها (worker انقضا و…) */
export async function invalidateStorefrontForVariants(variantIds: string[]): Promise<void> {
  const ids = variantIds.filter(Boolean);
  if (ids.length === 0) return;
  const rows = await db.variant.findMany({
    where: { id: { in: ids } },
    select: { productId: true },
  });
  await invalidateStorefrontForProducts(rows.map((r) => r.productId));
}
