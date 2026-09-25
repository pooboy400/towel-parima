/**
 * Outbox Worker — نامه‌رسان فروشگاه (بخش ۱۵.۱ سند) — M5
 * ---------------------------------------------------------------
 * جریان: PENDING due → claim اتمیک (PROCESSING) → dispatch به handler
 *       → DONE   یا   retry با backoff نمایی ۱→۲→۴→۸→…→۱۲۸ دقیقه
 *       → پس از ۸ تلاش: FAILED (در پنل قابل مشاهده).
 *
 * بازیابی crash: رخدادهایی که >۱۰ دقیقه در PROCESSING گیر کرده‌اند
 * (پروسه هنگام claim مرده) دوباره PENDING می‌شوند.
 *
 * idempotency (§11): claim شرطی updateMany با گارد status=PENDING —
 * در چند-ورکر هم حداکثر یک claim برنده می‌شود.
 */

import { db } from "@/lib/db";
import { getOutboxHandler } from "./outbox-handlers";

/** backoff نمایی — ایندکس = تلاش شمارهٔ n (دقیقه) */
const BACKOFF_MINUTES = [1, 2, 4, 8, 16, 32, 64, 128];
const MAX_ATTEMPTS = 8;
/** پس از این مدت، claimPROCESSING که برگشته = گم‌شده (crash) */
const STALE_CLAIM_MS = 10 * 60 * 1000;

export interface WorkerSweepResult {
  processed: number;
  succeeded: number;
  retried: number;
  failed: number;
  recovered: number;
}

/** یک دور کامل پاک‌سازی صندوق خروجی — idempotent و امن برای فراخوانی مکرر */
export async function sweepOutboxOnce(limit = 20): Promise<WorkerSweepResult> {
  const now = new Date();
  const result: WorkerSweepResult = {
    processed: 0,
    succeeded: 0,
    retried: 0,
    failed: 0,
    recovered: 0,
  };

  // ── ۱. بازیابی claimهای گم‌شده (crash recovery)
  const recovered = await db.outboxEvent.updateMany({
    where: { status: "PROCESSING", claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
    data: { status: "PENDING", claimedAt: null },
  });
  result.recovered = recovered.count;

  // ── ۲. رخدادهای سررسیدشده — قدیمی‌ترین اول (ترتیب پردازش هر سفارش تضمین می‌شود §15.1)
  const due = await db.outboxEvent.findMany({
    where: { status: "PENDING", availableAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const { id } of due) {
    // ── ۳. claim اتمیک — فقط یک برنده
    const claimed = await db.outboxEvent.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "PROCESSING", claimedAt: now },
    });
    if (claimed.count === 0) continue;

    const event = await db.outboxEvent.findUnique({
      where: { id },
      select: { id: true, type: true, payload: true, attempts: true },
    });
    if (!event) continue;

    result.processed += 1;
    const handler = getOutboxHandler(event.type);
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    try {
      if (handler) {
        await handler(payload);
        await db.outboxEvent.update({
          where: { id: event.id },
          data: { status: "DONE", processedAt: new Date(), lastError: null, claimedAt: null },
        });
        result.succeeded += 1;
      } else {
        // نوع بدون مصرف‌کننده — بسته می‌شود (نه خطا؛ شبح در جریان نمی‌ماند)
        await db.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "DONE",
            processedAt: new Date(),
            lastError: "بدون مصرف‌کننده — رد شد",
            claimedAt: null,
          },
        });
        result.succeeded += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 500) : "خطای ناشناخته";
      const attempts = event.attempts + 1;

      if (attempts >= MAX_ATTEMPTS) {
        await db.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "FAILED",
            attempts,
            lastError: message,
            claimedAt: null,
          },
        });
        result.failed += 1;
        console.error(
          JSON.stringify({
            level: "error",
            worker: "outbox",
            msg: "رخداد پس از ۸ تلاش FAILED شد",
            type: event.type,
            id: event.id,
            error: message,
          }),
        );
      } else {
        const delayMin = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
        await db.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "PENDING",
            attempts,
            lastError: message,
            claimedAt: null,
            availableAt: new Date(Date.now() + delayMin * 60 * 1000),
          },
        });
        result.retried += 1;
        console.warn(
          JSON.stringify({
            level: "warn",
            worker: "outbox",
            msg: `تلاش ${attempts} ناموفق — ${delayMin} دقیقه بعد دوباره`,
            type: event.type,
            id: event.id,
            error: message,
          }),
        );
      }
    }
  }

  return result;
}
