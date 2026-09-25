/**
 * CartService — سبد خرید سروری (بخش ۴.۳ و ۷ سند معماری)
 * ---------------------------------------------------------------
 * سبد کاربر لاگین‌شده در DB نگهداری می‌شود (Cart/CartItem)؛ سبد مهمان در
 * localStorage می‌ماند و هنگام ورود با mergeGuestCart ادغام می‌شود (M4).
 *
 * قواعد:
 *  · حقیقت موجودی = stock − reserved (بخش ۱۳) — سقف هر خط = min(available, ۲۰)
 *  · اقلام مرده (واریانت حذف/غیرفعال یا محصول غیرفعال) هنگام خواندن پاک می‌شوند
 *  · lineId = productId__colorId__sizeId — هم‌شکل خط سبد مهمان برای reconciled شدن
 */

import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import type { CartLine } from "@/types";

/** سقف هر خط سبد (ERD بخش ۴.۳) */
export const MAX_LINE_QTY = 20;

type VariantRow = Awaited<ReturnType<typeof hydrateVariants>>[number];

/** شکل خط داده‌ای سبد مهمان برای merge — variantId + تعداد */
export interface GuestCartLineInput {
  variantId: string;
  quantity: number;
}

/** ساخت lineId هم‌شکل کلاینت از واریانت */
function buildLineId(
  productId: string,
  colorId: string | null,
  sizeId: string | null,
): string {
  return [productId, colorId ?? "-", sizeId ?? "-"].join("__");
}

/** خواندن واریانت‌ها با همه وابستگی‌های نمایشی — یک کوئری */
function hydrateVariants(variantIds: readonly string[]) {
  return db.variant.findMany({
    where: { id: { in: [...variantIds] } },
    select: {
      id: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      reserved: true,
      isActive: true,
      deletedAt: true,
      colorId: true,
      sizeId: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          deletedAt: true,
          images: { select: { storageKey: true, sortOrder: true } },
        },
      },
      color: { select: { id: true, name: true, hex: true } },
      size: { select: { id: true, name: true, dimensions: true, gsm: true } },
    },
  });
}

/** آیا واریانت از نظر کاتالوگ زنده است؟ */
function isVariantLive(v: VariantRow): boolean {
  return (
    !v.deletedAt &&
    v.isActive &&
    v.product.deletedAt === null &&
    v.product.status === "ACTIVE"
  );
}

/** موجودی آزاد ردیف واریانت */
function availableOf(v: VariantRow): number {
  return Math.max(0, v.stock - v.reserved);
}

/** تبدیل ردیف واریانت به خط سبد — maxStock = available واقعی */
function toCartLine(v: VariantRow): CartLine {
  const images = [...v.product.images].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    lineId: buildLineId(v.product.id, v.colorId, v.sizeId),
    productId: v.product.id,
    slug: v.product.slug,
    name: v.product.name,
    image: images[0]?.storageKey ?? "",
    colorName: v.color?.name,
    colorHex: v.color?.hex,
    sizeLabel: v.size?.name,
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? undefined,
    quantity: 0,
    maxStock: availableOf(v),
  };
}

/** cartId کاربر را می‌آورد (بدون ساخت) */
async function findCartId(userId: string): Promise<string | null> {
  const cart = await db.cart.findUnique({
    where: { userId },
    select: { id: true },
  });
  return cart?.id ?? null;
}

/** cart کاربر را می‌سازد (upsert) */
async function ensureCartId(userId: string): Promise<string> {
  const cart = await db.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });
  return cart.id;
}

/* ------------------------------------------------------------------ */
/* خواندن                                                              */
/* ------------------------------------------------------------------ */

/**
 * خط‌های سبد سروری کاربر — hydrated و هم‌شکل CartLine کلاینت.
 * اقلام مرده حذف می‌شوند (از DB هم) و تعداد به سقف موجودی بسته می‌شود.
 */
export async function getServerCartLines(userId: string): Promise<CartLine[]> {
  const cartId = await findCartId(userId);
  if (!cartId) return [];

  const items = await db.cartItem.findMany({
    where: { cartId },
    select: { id: true, variantId: true, quantity: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (items.length === 0) return [];

  const variants = await hydrateVariants(items.map((i) => i.variantId));
  const byId = new Map(variants.map((v) => [v.id, v]));

  const deadItemIds: string[] = [];
  const lines: CartLine[] = [];

  for (const item of items) {
    const variant = byId.get(item.variantId);
    if (!variant || !isVariantLive(variant)) {
      deadItemIds.push(item.id);
      continue;
    }
    const available = availableOf(variant);
    if (available <= 0) {
      // موجود صفر → خط باقی می‌ماند با maxStock 0 (UI پیام می‌دهد) — qty=0 نمی‌سازیم
      deadItemIds.push(item.id);
      continue;
    }
    const line = toCartLine(variant);
    line.quantity = Math.min(item.quantity, available, MAX_LINE_QTY);
    lines.push(line);
  }

  // پاکسازی از DB — خواندن = پاکسازی اقلام نامعتبر
  if (deadItemIds.length > 0) {
    await db.cartItem.deleteMany({ where: { id: { in: deadItemIds } } });
  }

  return lines;
}

/* ------------------------------------------------------------------ */
/* تغییرها (کاربر لاگین‌شده)                                            */
/* ------------------------------------------------------------------ */

/** افزودن به سبد سروری — تجمعی؛ سقف = min(available, 20) */
export async function addToServerCart(
  userId: string,
  input: { variantId: string; quantity?: number },
): Promise<CartLine[]> {
  const qty = Math.max(1, Math.floor(input.quantity ?? 1));

  const variant = await hydrateVariants([input.variantId]).then((r) => r[0]);
  if (!variant || !isVariantLive(variant)) {
    throw new DomainError("NOT_FOUND", "این کالا دیگر قابل خرید نیست.");
  }
  const available = availableOf(variant);
  if (available <= 0) {
    throw new DomainError("OUT_OF_STOCK", "موجودی این کالا تمام شده است.");
  }

  const cartId = await ensureCartId(userId);
  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId: input.variantId } },
    select: { quantity: true },
  });
  const wanted = Math.min((existing?.quantity ?? 0) + qty, available, MAX_LINE_QTY);

  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId: input.variantId } },
    update: { quantity: wanted },
    create: { cartId, variantId: input.variantId, quantity: wanted },
  });

  return getServerCartLines(userId);
}

/** تغییر تعداد خط — qty < 1 یعنی حذف؛ سقف = min(available, 20) */
export async function updateServerCartQuantity(
  userId: string,
  input: { variantId: string; quantity: number },
): Promise<CartLine[]> {
  const cartId = await findCartId(userId);
  if (!cartId) return [];

  if (input.quantity < 1) {
    await db.cartItem.deleteMany({
      where: { cartId, variantId: input.variantId },
    });
    return getServerCartLines(userId);
  }

  const variant = await hydrateVariants([input.variantId]).then((r) => r[0]);
  if (!variant || !isVariantLive(variant)) {
    throw new DomainError("NOT_FOUND", "این کالا دیگر قابل خرید نیست.");
  }
  const wanted = Math.min(
    Math.floor(input.quantity),
    availableOf(variant),
    MAX_LINE_QTY,
  );

  await db.cartItem.updateMany({
    where: { cartId, variantId: input.variantId },
    data: { quantity: wanted },
  });

  return getServerCartLines(userId);
}

/** حذف یک خط سبد */
export async function removeServerCartItem(
  userId: string,
  input: { variantId: string },
): Promise<CartLine[]> {
  const cartId = await findCartId(userId);
  if (!cartId) return [];
  await db.cartItem.deleteMany({ where: { cartId, variantId: input.variantId } });
  return getServerCartLines(userId);
}

/** خالی‌کردن کل سبد */
export async function clearServerCart(userId: string): Promise<void> {
  const cartId = await findCartId(userId);
  if (!cartId) return;
  await db.cartItem.deleteMany({ where: { cartId } });
}

/* ------------------------------------------------------------------ */
/* ادغام سبد مهمان بعد از ورود (M4)                                     */
/* ------------------------------------------------------------------ */

/**
 * ادغام خط‌های سبد مهمان (localStorage) با سبد سروری کاربر — طلایی:
 *  · همان واریانت → تجمعی، سقف = min(available, 20)
 *  · واریانت مرده/ناموجود → بی‌سروصدا رد می‌شود
 *  · هیچ آیتمی گم یا دوبله نمی‌شود
 */
export async function mergeGuestCart(
  userId: string,
  guestLines: readonly GuestCartLineInput[],
): Promise<CartLine[]> {
  const clean = guestLines
    .map((l) => ({ variantId: String(l.variantId), qty: Math.floor(Number(l.quantity)) }))
    .filter((l) => l.variantId && Number.isInteger(l.qty) && l.qty > 0);

  if (clean.length === 0) return getServerCartLines(userId);

  const cartId = await ensureCartId(userId);
  const existingItems = await db.cartItem.findMany({
    where: { cartId },
    select: { variantId: true, quantity: true },
  });
  const existingMap = new Map(existingItems.map((i) => [i.variantId, i.quantity]));

  // تجمیع تقاضای مهمان روی همان واریانت‌ها
  const wantedMap = new Map<string, number>();
  for (const line of clean) {
    wantedMap.set(line.variantId, (wantedMap.get(line.variantId) ?? 0) + line.qty);
  }

  // اعتبارسنجی گروهی واریانت‌ها
  const variants = await hydrateVariants([...wantedMap.keys()]);
  const liveById = new Map(variants.filter(isVariantLive).map((v) => [v.id, v]));

  for (const [variantId, guestQty] of wantedMap) {
    const variant = liveById.get(variantId);
    if (!variant) continue; // واریانت مرده — رد
    const available = availableOf(variant);
    if (available <= 0) continue; // ناموجود — رد

    const merged = Math.min(
      (existingMap.get(variantId) ?? 0) + guestQty,
      available,
      MAX_LINE_QTY,
    );

    await db.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      update: { quantity: merged },
      create: { cartId, variantId, quantity: merged },
    });
  }

  return getServerCartLines(userId);
}
