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
    void import("@/app/cart/actions").then(async (mod) => {
      const [serverCart, state] = await Promise.all([
        mod.getServerCartAction().catch(() => null),
        mod
          .getCustomerStateAction()
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
      }
    });
  }, []);
  return null;
}
