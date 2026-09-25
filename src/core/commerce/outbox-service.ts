/**
 * OutboxService — enqueue رخدادها (بخش ۱۵ سند)
 * ---------------------------------------------------------------
 * v1: فقط enqueue (درج رکورد PENDING) داخل همان tx تماس‌گیرنده.
 * dispatch/worker در M5 (Outbox + Worker + قالب‌های SMS/Email) وصل می‌شود؛
 * امضای enqueue ثابت می‌ماند.
 */

import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface OutboxEnqueueInput {
  type: string;
  payload: Record<string, unknown>;
  /** تأخیر انتشار — پیش‌فرض بلافاصله */
  delayMs?: number;
}

/** enqueue اتمیک همزمان با تغییر دامنه — قانون طلایی: هیچ SMS/Email داخل tx */
export async function enqueueOutbox(
  tx: Tx,
  input: OutboxEnqueueInput,
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue,
      status: "PENDING",
      availableAt: new Date(Date.now() + (input.delayMs ?? 0)),
    },
  });
}
