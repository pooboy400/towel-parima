"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart-store";

/**
 * ClearCartOnMount — پس از پرداخت موفق، سبد سروری و محلی پاک می‌شود.
 * جزیره بدون UI داخل صفحه موفقیت. اگر کاربر مهمان باشد همین کار را می‌کند.
 */
export function ClearCartOnMount() {
  useEffect(() => {
    const store = useCartStore.getState();
    store.clear();
    // اگر ورود داشته باشد، clear خودش سمت سرور را هم خالی می‌کند —
    // برای مهمان فقط localStorage پاک می‌شود که کافی است.
  }, []);
  return null;
}
