/**
 * Cart Logic — محاسبات سبد خرید
 * جدا از UI و Store تا قابل تست و قابل انتقال به بک‌اند باشد (پرامپت 74)
 * نرخ‌های ارسال پارامتری‌اند (rates) — UI زنده از Settings دیتابیس می‌گیرد و
 * می‌فرستد؛ پیش‌فرض، مقادیر fallback از lib/config است.
 */
import type { CartLine, CartLine as Line, OrderSummaryTotals } from "@/types";
import { storeConfig } from "@/lib/config";

/** نرخ‌های ارسال که UI از Settings دیتابیس دریافت و به توابع می‌دهد */
export interface ShippingRates {
  freeShippingThreshold: number;
  standardShippingCost: number;
  expressShippingCost: number;
}

export function getSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

export function getDiscount(lines: CartLine[]): number {
  return lines.reduce(
    (sum, l) =>
      l.compareAtPrice && l.compareAtPrice > l.price
        ? sum + (l.compareAtPrice - l.price) * l.quantity
        : sum,
    0,
  );
}

export interface ShippingInput {
  subtotal: number;
  method?: "standard" | "express";
}

export function getShipping(
  { subtotal, method = "standard" }: ShippingInput,
  rates: ShippingRates = storeConfig,
): number {
  if (subtotal === 0) return 0;
  if (subtotal >= rates.freeShippingThreshold) return 0;
  return method === "express"
    ? rates.expressShippingCost
    : rates.standardShippingCost;
}

export function getTotals(
  lines: CartLine[],
  method: "standard" | "express" = "standard",
  rates: ShippingRates = storeConfig,
): OrderSummaryTotals {
  const subtotal = getSubtotal(lines);
  const discount = getDiscount(lines);
  const shipping = getShipping({ subtotal, method }, rates);
  return {
    subtotal,
    discount,
    shipping,
    total: subtotal + shipping,
  };
}

export function getCartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function getFreeShippingRemaining(
  subtotal: number,
  threshold: number = storeConfig.freeShippingThreshold,
): number {
  return Math.max(0, threshold - subtotal);
}

export type { Line };
