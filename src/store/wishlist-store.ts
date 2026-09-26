"use client";

/**
 * Wishlist Store — پرامپت 54: Add / Remove / Move to Cart
 * در فاز 2 با Account کاربر همگام می‌شود (پرامپت 41).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useCartStore } from "./cart-store";

/** UX-03 (فاز ۴) — همگام‌سازی سرور فقط برای مشتری لاگین‌شده (الگوی cart serverSync) */
function serverToggle(slug: string, adding: boolean) {
  if (useCartStore.getState().customer) {
    void import("@/app/account/wishlist-actions")
      .then((m) => m.toggleWishlistAction(slug, adding))
      .catch(() => {});
  }
}

interface WishlistState {
  /** لیست slug محصولات */
  items: string[];
  toggle: (slug: string) => boolean;
  remove: (slug: string) => void;
  has: (slug: string) => boolean;
  clear: () => void;
  /** UX-03 — جایگزینی با حقیقت سرور (بعد از ورود/لود) */
  setItems: (items: string[]) => void;
  /** UX-03 — مهاجرت لیست محلی به سرور + هیدریشن از سرور (بعد از ورود/لود) */
  hydrateFromServer: () => Promise<void>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (slug) => {
        const has = get().items.includes(slug);
        set({
          items: has
            ? get().items.filter((s) => s !== slug)
            : [...get().items, slug],
        });
        serverToggle(slug, !has);
        return !has;
      },
      remove: (slug) => {
        set({ items: get().items.filter((s) => s !== slug) });
        serverToggle(slug, false);
      },
      has: (slug) => get().items.includes(slug),
      clear: () => set({ items: [] }),
      setItems: (items) => set({ items }),
      hydrateFromServer: async () => {
        if (!useCartStore.getState().customer) return;
        try {
          const m = await import("@/app/account/wishlist-actions");
          const res = await m.syncWishlistAction(get().items);
          if (res.ok) set({ items: res.slugs });
        } catch {
          // مهمان/آفلاین — لیست محلی معتبر می‌ماند
        }
      },
    }),
    {
      name: "prima-wishlist-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
