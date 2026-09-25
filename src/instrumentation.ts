/**
 * Next.js Instrumentation — hook راه‌اندازی پروسه (M5)
 * سند معماری §15.1: worker درون-پروسه‌ای — هر بار سرور بالا می‌آید اینجا
 * تایمرهای پس‌زمینه (Outbox ۵ ثانیه‌ای + انقضای رزرو ۵ دقیقه‌ای) روشن می‌شوند.
 */

export async function register() {
  // فقط runtime واقعی Node — نه edge و نه فاز build
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // هشدار بلند برای دموی صریح — هرگز در production واقعی نباید ببینید
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCKS_IN_PRODUCTION === "1") {
    console.warn(
      JSON.stringify({
        level: "warn",
        tag: "mocks-in-production",
        msg: "[MOCKS-IN-PRODUCTION] providerهای mock (پرداخت/پیامک) در بیلد production فعال‌اند — فقط برای دمو/staging. در سرور واقعی ALLOW_MOCKS_IN_PRODUCTION را حذف کنید!",
        at: new Date().toISOString(),
      }),
    );
  }

  const { startBackgroundWorkers } = await import("@/core/async/start-workers");
  startBackgroundWorkers();
}
