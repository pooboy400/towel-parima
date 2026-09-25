/**
 * Next.js Instrumentation — hook راه‌اندازی پروسه (M5)
 * سند معماری §15.1: worker درون-پروسه‌ای — هر بار سرور بالا می‌آید اینجا
 * تایمرهای پس‌زمینه (Outbox ۵ ثانیه‌ای + انقضای رزرو ۵ دقیقه‌ای) روشن می‌شوند.
 */

export async function register() {
  // فقط runtime واقعی Node — نه edge و نه فاز build
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startBackgroundWorkers } = await import("@/core/async/start-workers");
  startBackgroundWorkers();
}
