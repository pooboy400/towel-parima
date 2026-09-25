/**
 * Background Workers — برق‌انداز نامه‌رسان و انقضای رزرو (M5)
 * ---------------------------------------------------------------
 * از instrumentation (register) یک‌بار در هر پروسه صدا زده می‌شود.
 * - Outbox worker: هر ۵ ثانیه (§15.1)
 * - انقضای رزرو: هر ۵ دقیقه (§13 — TTL ۲۰ دقیقه)
 *
 * ایمنی‌ها: گارد globalThis (جلوگیری از دوبل با HMR/hot reload) · unref
 * (مانع shutdown نمی‌شود) · فلگ running (همپوشانی دورها ممنوع) · try/catch
 * کامل (خطای یک دور، تایمر را نمی‌کشد).
 */

import { sweepOutboxOnce } from "./outbox-worker";
import { expireStaleReservations } from "@/core/commerce/inventory-service";

const OUTBOX_TICK_MS = 5_000;
const RESERVATION_TICK_MS = 5 * 60 * 1000;

const g = globalThis as typeof globalThis & {
  __primaWorkersStarted?: boolean;
};

export function startBackgroundWorkers(): void {
  if (g.__primaWorkersStarted) return;
  g.__primaWorkersStarted = true;

  // ── Outbox — هر ۵ ثانیه
  let outboxRunning = false;
  const outboxTick = async () => {
    if (outboxRunning) return;
    outboxRunning = true;
    try {
      const r = await sweepOutboxOnce();
      if (r.processed > 0) {
        console.log(
          JSON.stringify({
            level: "info",
            worker: "outbox",
            msg: `دور کامل شد: ${r.succeeded} موفق · ${r.retried} در صف دوباره · ${r.failed} FAILED · ${r.recovered} بازیابی`,
          }),
        );
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          worker: "outbox",
          msg: "دور worker خطا داد",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      outboxRunning = false;
    }
  };

  const outboxTimer = setInterval(outboxTick, OUTBOX_TICK_MS);
  outboxTimer.unref?.();

  // ── انقضای رزرو — هر ۵ دقیقه
  let expiryRunning = false;
  const expiryTick = async () => {
    if (expiryRunning) return;
    expiryRunning = true;
    try {
      const expired = await expireStaleReservations();
      if (expired > 0) {
        console.log(
          JSON.stringify({
            level: "info",
            worker: "reservation-expiry",
            msg: `${expired} رزرو منقضی شد و موجودی آزاد گردید`,
          }),
        );
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          worker: "reservation-expiry",
          msg: "دور انقضای رزرو خطا داد",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      expiryRunning = false;
    }
  };

  const expiryTimer = setInterval(expiryTick, RESERVATION_TICK_MS);
  expiryTimer.unref?.();

  // دور اول بلافاصله — بدون انتظار برای تیک اول
  void outboxTick();
  void expiryTick();

  console.log(
    JSON.stringify({
      level: "info",
      worker: "bootstrap",
      msg: "کارگرهای پس‌زمینه روشن شدند (outbox هر ۵ ثانیه · انقضای رزرو هر ۵ دقیقه)",
    }),
  );
}
