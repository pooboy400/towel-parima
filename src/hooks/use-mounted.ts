"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * تشخیص mount — برای مقادیر حساس به Hydration (مثل localStorage stores)
 * الگوی توصیه‌شده React بدون setState-in-effect
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
