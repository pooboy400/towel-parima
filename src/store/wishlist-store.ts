"use client";

/**
 * Wishlist Store — پرامپت 54: Add / Remove / Move to Cart
 * در فاز 2 با Account کاربر همگام می‌شود (پرامپت 41).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface WishlistState {
  /** لیست slug محصولات */
  items: string[];
  toggle: (slug: string) => boolean;
  remove: (slug: string) => void;
  has: (slug: string) => boolean;
  clear: () => void;
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
        return !has;
      },
      remove: (slug) =>
        set({ items: get().items.filter((s) => s !== slug) }),
      has: (slug) => get().items.includes(slug),
      clear: () => set({ items: [] }),
    }),
    {
      name: "prima-wishlist-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
