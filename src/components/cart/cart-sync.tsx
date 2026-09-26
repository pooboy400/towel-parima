"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart-store";

/**
 * CartSync — جزیره بدون UI در layout فروشگاه.
 * · بار اول: وضعیت ورود خوانده می‌شود؛ اگر مشتری باشد سبد سروری جایگزین محلی
 *   (جلوگیری از دوبله‌شدن خط‌ها در دو جهان).
 * · بعد از ورود هم syncAfterLogin ادغام می‌کند (لایه دوم).
 */
export function CartSync() {
  useEffect(() => {
    void Promise.all([import("@/app/cart/actions"), import("@/app/account/actions")]).then(
      async ([cartMod, accountMod]) => {
        const [serverCart, state] = await Promise.all([
          cartMod.getServerCartAction().catch(() => null),
          accountMod
            .getCustomerStateAction() // UX-14 — منبع یکتا
            .catch(() => null),
        ]);
      const store = useCartStore.getState();

      store.setCustomer(
        state?.customer
          ? { userId: state.customer.userId, name: state.customer.name }
          : null,
      );

      if (state?.customer && serverCart?.ok) {
        // مشتری: سبد سروری حقیقت است — جایگزین محلی (ادغام قطعی در syncAfterLogin)
        store.replaceLines(serverCart.lines);
        // UX-03 — بج/صفحهٔ علاقه‌مندی از سرور هیدریت شود (دستگاه دوم هم درست)
        void import("@/store/wishlist-store").then((w) =>
          w.useWishlistStore.getState().hydrateFromServer(),
        );
      }
    });
  }, []);
  return null;
}
