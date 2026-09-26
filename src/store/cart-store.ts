"use client";

/**
 * Cart Store — سبد خرید دو جهانی (M4)
 * ---------------------------------------------------------------
 * · مهمان: سبد در localStorage (persist) — رفتار فاز ۱ دست‌نخورده
 * · مشتری لاگین: هر تغییر بعد از به‌روزرسانی محلی به سبد سروری هم می‌رود
 *   (fire-and-forget + تصحیح با پاس سرور) — replaceLines ترتیب محلی را نگه می‌دارد
 * · ورود: syncAfterLogin سبد مهمان را با mergeGuestCart ادغام می‌کند (بدون گم شدن)
 * منطق محاسبه قیمت‌ها در src/lib/cart-logic.ts نگه‌داری می‌شود.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartLine, Product } from "@/types";

interface CartCustomer {
  userId: string;
  name: string | null;
}

interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  /** وضعیت ورود مشتری — با CartSync/syncAfterLogin تنظیم می‌شود؛ persist نمی‌شود */
  customer: CartCustomer | null;
  addLine: (
    product: Product,
    opts: {
      colorId?: string;
      sizeId?: string;
      quantity?: number;
    },
  ) => void;
  removeLine: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** جایگزینی کامل خط‌ها — از پاس سرور (CartSync/merge) */
  replaceLines: (lines: CartLine[]) => void;
  setCustomer: (customer: CartCustomer | null) => void;
  /** بعد از ورود: ادغام سبد مهمان با سبد سروری */
  syncAfterLogin: () => Promise<void>;
}

function buildLineId(productId: string, colorId?: string, sizeId?: string) {
  return [productId, colorId ?? "-", sizeId ?? "-"].join("__");
}

/** اکشن‌های سروری — dynamic import تا bundle کلاینت سبک بماند */
function serverSync(fnName: string, ...args: unknown[]) {
  void import("@/app/cart/actions").then(async (mod) => {
    const fn = (mod as unknown as Record<string, (...a: unknown[]) => Promise<{ ok: boolean; lines?: CartLine[] }>>)[fnName];
    if (!fn) return;
    const res = await fn(...args).catch(() => null);
    // تصحیح با حقیقت سرور — فقط اگر درخواست پاسخ داد
    if (res?.ok && res.lines) {
      useCartStore.getState().replaceLines(res.lines);
    }
  });
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      isOpen: false,
      customer: null,

      addLine: (product, opts) => {
        const color = opts.colorId
          ? product.colors.find((c) => c.id === opts.colorId)
          : undefined;
        const size = opts.sizeId
          ? product.sizes.find((s) => s.id === opts.sizeId)
          : undefined;
        const lineId = buildLineId(product.id, color?.id, size?.id);
        const quantity = Math.max(1, opts.quantity ?? 1);

        const existing = get().lines.find((l) => l.lineId === lineId);
        if (existing) {
          // اعتبارسنجی موجودی — پرامپت 76
          const nextQty = Math.min(existing.quantity + quantity, product.stock);
          // BUG-07 (فاز ۳) — clamp به صفر خطِ صفرتایی (شبح) نمی‌سازد؛
          // همان رفتار updateQuantity: حذف خط + sync سرور
          if (nextQty < 1) {
            set({ lines: get().lines.filter((l) => l.lineId !== lineId) });
            if (get().customer) serverSync("removeServerCartItemAction", { lineId });
            return;
          }
          set({
            lines: get().lines.map((l) =>
              l.lineId === lineId ? { ...l, quantity: nextQty } : l,
            ),
          });
        } else {
          // BUG-07 (فاز ۳) — محصول ناموجود (stock=0) اصلاً وارد سبد نمی‌شود؛
          // قبلاً Math.min(qty, 0)=0 خط صفرتایی می‌ساخت و در چک‌اوت خطای گیج‌کننده می‌داد
          const clampedQty = Math.min(quantity, product.stock);
          if (clampedQty < 1) return;
          const line: CartLine = {
            lineId,
            productId: product.id,
            slug: product.slug,
            name: product.name,
            image: product.images[0],
            colorName: color?.name,
            colorHex: color?.hex,
            sizeLabel: size?.label ? `${size.label} · ${size.dimensions}` : undefined,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            quantity: clampedQty,
            maxStock: product.stock,
          };
          set({ lines: [...get().lines, line] });
        }

        if (get().customer) {
          serverSync("addToServerCartAction", {
            lineId,
            quantity,
          });
        }
        set({ isOpen: true }); // باز شدن Cart Drawer پس از Add to Cart — پرامپت 48
      },

      removeLine: (lineId) => {
        set({ lines: get().lines.filter((l) => l.lineId !== lineId) });
        if (get().customer) serverSync("removeServerCartItemAction", { lineId });
      },

      updateQuantity: (lineId, quantity) => {
        if (quantity < 1) {
          set({ lines: get().lines.filter((l) => l.lineId !== lineId) });
          if (get().customer) serverSync("updateServerCartQuantityAction", { lineId, quantity: 0 });
          return;
        }
        set({
          lines: get().lines.map((l) =>
            l.lineId === lineId
              ? { ...l, quantity: Math.min(quantity, l.maxStock) }
              : l,
          ),
        });
        if (get().customer) serverSync("updateServerCartQuantityAction", { lineId, quantity });
      },

      clear: () => {
        set({ lines: [] });
        if (get().customer) serverSync("clearServerCartAction");
      },

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set({ isOpen: !get().isOpen }),

      replaceLines: (lines) => {
        // حفظ ترتیب محلی برای خط‌های مشترک — خط‌های تازه سرور ته لیست
        const current = get().lines;
        const serverMap = new Map(lines.map((l) => [l.lineId, l]));
        const kept = current
          .map((l) => serverMap.get(l.lineId))
          .filter((l): l is CartLine => Boolean(l));
        const keptIds = new Set(kept.map((l) => l.lineId));
        const fresh = lines.filter((l) => !keptIds.has(l.lineId));
        set({ lines: [...kept, ...fresh] });
      },

      setCustomer: (customer) => set({ customer }),

      syncAfterLogin: async () => {
        const [{ mergeGuestCartAction }, { getCustomerStateAction: customerState }] =
          await Promise.all([
            import("@/app/cart/actions"),
            import("@/app/account/actions"), // UX-14 — منبع یکتا
          ]);
        const state = await customerState().catch(() => null);
        if (!state?.customer) return;

        set({
          customer: {
            userId: state.customer.userId,
            name: state.customer.name,
          },
        });

        const guestLines = get().lines.map((l) => ({
          lineId: l.lineId,
          quantity: l.quantity,
        }));
        const res = await mergeGuestCartAction({ lines: guestLines }).catch(() => null);
        if (res?.ok) {
          get().replaceLines(res.lines);
        }
      },
    }),
    {
      name: "prima-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);
