"use server";

/**
 * Wishlist Actions — UX-03 (فاز ۴)
 * ---------------------------------------------------------------
 * علاقه‌مندی واقعی DB (جدول WishlistItem) — قبلاً فقط localStorage بود و
 * با تعویض دستگاه لیست می‌پرید. فقط مشتری لاگین‌شده؛ مهمان روی localStorage
 * می‌ماند و بعد از ورود با syncWishlistAction مهاجرت داده می‌شود.
 */

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireCustomerContext } from "@/core/auth/customer-session";
import { DomainError } from "@/core/errors";

/** آستانهٔ ایمن — لیست علاقه‌مندی معقول محدود است */
const MAX_ITEMS = 200;

async function resolveSlugs(slugs: string[]) {
  if (slugs.length === 0) return [];
  return db.product.findMany({
    where: { slug: { in: slugs }, deletedAt: null },
    select: { id: true, slug: true },
  });
}

async function serverSlugs(userId: string): Promise<string[]> {
  const rows = await db.wishlistItem.findMany({
    where: { userId },
    select: { product: { select: { slug: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((w) => w.product.slug);
}

/**
 * مهاجرت لیست محلی مهمان به سرور (بعد از ورود) — یک‌بارمصرف و idempotent
 * (skipDuplicates)؛ خروجی: لیست رسمی سرور برای همگام‌سازی استور.
 */
export async function syncWishlistAction(
  slugs: string[],
): Promise<{ ok: true; slugs: string[] } | { ok: false; message: string }> {
  try {
    const ctx = await requireCustomerContext();
    const unique = [...new Set(slugs.filter(Boolean))].slice(0, MAX_ITEMS);
    const rows = await resolveSlugs(unique);
    if (rows.length > 0) {
      await db.wishlistItem.createMany({
        data: rows.map((r) => ({ userId: ctx.userId, productId: r.id })),
        skipDuplicates: true,
      });
    }
    const slugsOut = await serverSlugs(ctx.userId);
    revalidatePath("/wishlist");
    return { ok: true, slugs: slugsOut };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("syncWishlistAction failed:", error);
    return { ok: false, message: "همگام‌سازی علاقه‌مندی‌ها ناموفق بود." };
  }
}

/** افزودن/حذف سمت سرور — از استور کلاینت بعد از هر toggle صدا زده می‌شود */
export async function toggleWishlistAction(
  slug: string,
  add: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const ctx = await requireCustomerContext();
    const product = await db.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (product) {
      if (add) {
        // سقف محافظه‌کارانه — بیشتر از MAX_ITEMS ردیف برای یک کاربر نمی‌سازیم
        const count = await db.wishlistItem.count({ where: { userId: ctx.userId } });
        if (count >= MAX_ITEMS) {
          return { ok: false, message: "لیست علاقه‌مندی‌ها پر شده است." };
        }
        await db.wishlistItem.upsert({
          where: {
            userId_productId: { userId: ctx.userId, productId: product.id },
          },
          create: { userId: ctx.userId, productId: product.id },
          update: {},
        });
      } else {
        await db.wishlistItem.deleteMany({
          where: { userId: ctx.userId, productId: product.id },
        });
      }
    }
    revalidatePath("/wishlist");
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("toggleWishlistAction failed:", error);
    return { ok: false, message: "به‌روزرسانی علاقه‌مندی ناموفق بود." };
  }
}

/** لیست رسمی سرور — برای هیدریشن بج هدر/صفحه بعد از لود */
export async function getWishlistAction(): Promise<
  { ok: true; slugs: string[] } | { ok: false; message: string }
> {
  try {
    const ctx = await requireCustomerContext();
    return { ok: true, slugs: await serverSlugs(ctx.userId) };
  } catch {
    // مهمان — پاسخ تمیز (استور محلی معتبر می‌ماند)
    return { ok: false, message: "UNAUTHENTICATED" };
  }
}
