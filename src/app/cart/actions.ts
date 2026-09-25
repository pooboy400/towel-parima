/**
 * Cart Actions — سبد سروری کاربر لاگین (M4)
 * ---------------------------------------------------------------
 * کلاینت فقط lineId (productId__colorId__sizeId) و تعداد می‌فرستد؛
 * resolve سه‌تایی → variantId سمت سرور انجام می‌شود.
 * مهمان: no-op — سبد مهمان در localStorage می‌ماند.
 */

"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { MAX_CART_QUANTITY } from "@/lib/config";
import { getCustomerContext } from "@/core/auth/customer-session";
import {
  addToServerCart,
  getServerCartLines,
  updateServerCartQuantity,
  removeServerCartItem,
  clearServerCart,
  mergeGuestCart,
} from "@/core/commerce/cart-service";
import type { CartLine } from "@/types";

const lineInputSchema = z.object({
  lineId: z
    .string()
    .trim()
    .min(3)
    .max(260)
    .refine((v) => v.split("__").length === 3, "شناسه خط سبد نامعتبر است."),
  quantity: z.number().int().min(0).max(MAX_CART_QUANTITY),
});

const tripleSchema = z.object({
  productId: z.string().min(1).max(64),
  colorId: z.string().max(64).nullish(),
  sizeId: z.string().max(64).nullish(),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
});

function parseLineId(lineId: string) {
  const parts = lineId.split("__");
  if (parts.length !== 3 || !parts[0]) return null;
  return {
    productId: parts[0],
    colorId: parts[1] === "-" ? null : parts[1],
    sizeId: parts[2] === "-" ? null : parts[2],
  };
}

/** resolve سه‌تایی → variantId (واریانت اصلی = sortOrder کمتر) */
async function resolveVariantId(triple: {
  productId: string;
  colorId: string | null;
  sizeId: string | null;
}): Promise<string | null> {
  const variant = await db.variant.findFirst({
    where: {
      productId: triple.productId,
      colorId: triple.colorId,
      sizeId: triple.sizeId,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  return variant?.id ?? null;
}

/** وضعیت مشتری برای استور سبد — مهمان: null */
export async function getCustomerStateAction(): Promise<{
  ok: true;
  customer: { userId: string; name: string | null; phone: string | null } | null;
}> {
  const customer = await getCustomerContext();
  return {
    ok: true,
    customer: customer
      ? { userId: customer.userId, name: customer.name, phone: customer.phone }
      : null,
  };
}

/** خط‌های سبد سروری — مهمان: [] */
export async function getServerCartAction(): Promise<{ ok: true; lines: CartLine[] }> {
  const customer = await getCustomerContext();
  if (!customer) return { ok: true, lines: [] };
  return { ok: true, lines: await getServerCartLines(customer.userId) };
}

export async function addToServerCartAction(input: {
  lineId: string;
  quantity?: number;
}): Promise<{ ok: true; lines: CartLine[] }> {
  const customer = await getCustomerContext();
  if (!customer) return { ok: true, lines: [] };

  const parsed = lineInputSchema.parse({
    lineId: input.lineId,
    quantity: input.quantity ?? 1,
  });
  const triple = parseLineId(parsed.lineId);
  if (!triple) return { ok: true, lines: await getServerCartLines(customer.userId) };

  const variantId = await resolveVariantId(triple);
  if (!variantId) return { ok: true, lines: await getServerCartLines(customer.userId) };

  return {
    ok: true,
    lines: await addToServerCart(customer.userId, {
      variantId,
      quantity: parsed.quantity,
    }),
  };
}

export async function updateServerCartQuantityAction(input: {
  lineId: string;
  quantity: number;
}): Promise<{ ok: true; lines: CartLine[] }> {
  const customer = await getCustomerContext();
  if (!customer) return { ok: true, lines: [] };

  const parsed = lineInputSchema.parse(input);
  const triple = parseLineId(parsed.lineId);
  if (!triple) return { ok: true, lines: await getServerCartLines(customer.userId) };

  const variantId = await resolveVariantId(triple);
  if (!variantId) {
    // واریانت مرده — اگر qty=0 بود یعنی حذف از سبد؛ خط سروری هم حذف شود
    if (parsed.quantity < 1) {
      return { ok: true, lines: await getServerCartLines(customer.userId) };
    }
    return { ok: true, lines: await getServerCartLines(customer.userId) };
  }

  return {
    ok: true,
    lines: await updateServerCartQuantity(customer.userId, {
      variantId,
      quantity: parsed.quantity,
    }),
  };
}

export async function removeServerCartItemAction(input: {
  lineId: string;
}): Promise<{ ok: true; lines: CartLine[] }> {
  const customer = await getCustomerContext();
  if (!customer) return { ok: true, lines: [] };

  const triple = parseLineId(input.lineId);
  if (!triple) return { ok: true, lines: await getServerCartLines(customer.userId) };

  const variantId = await resolveVariantId(triple);
  if (!variantId) return { ok: true, lines: await getServerCartLines(customer.userId) };

  return {
    ok: true,
    lines: await removeServerCartItem(customer.userId, { variantId }),
  };
}

export async function clearServerCartAction(): Promise<{ ok: true }> {
  const customer = await getCustomerContext();
  if (!customer) return { ok: true };
  await clearServerCart(customer.userId);
  return { ok: true };
}

/** ادغام سبد مهمان با سبد سروری بعد از ورود — طلایی M4 */
export async function mergeGuestCartAction(input: {
  lines: Array<{ lineId: string; quantity: number }>;
}): Promise<{ ok: true; lines: CartLine[] }> {
  const customer = await getCustomerContext();
  if (!customer) return { ok: true, lines: [] };

  const schema = z.object({ lines: z.array(lineInputSchema).max(100) });
  const parsed = schema.parse(input);

  // خط‌های مهمان: تبدیل به variantId + skip خط‌های نامعتبر
  const guestLines: Array<{ variantId: string; quantity: number }> = [];
  for (const line of parsed.lines) {
    const triple = parseLineId(line.lineId);
    if (!triple) continue;
    const variantId = await resolveVariantId(triple);
    if (!variantId) continue;
    guestLines.push({ variantId, quantity: line.quantity });
  }

  return { ok: true, lines: await mergeGuestCart(customer.userId, guestLines) };
}
