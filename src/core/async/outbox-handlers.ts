/**
 * Outbox Handlers — مصرف‌کنندگان رخدادها (بخش ۱۵.۲ سند) — M5
 * ---------------------------------------------------------------
 * هر handler: payload رخداد → اثر بیرونی (SMS) — هرگز داخل DB tx صدا زده نمی‌شود.
 * SMS: رندر قالب → ارسال با provider → ثبت در دفتر SmsLog (شیشهٔ پشت کارت‌خوان ادمین).
 *
 * idempotency خودِ worker: هر OutboxEvent فقط یک بار claim می‌شود (§11)؛
 * بنابراین هر رخداد حداکثر یک پیامک تولید می‌کند.
 */

import { db } from "@/lib/db";
import { smsProvider } from "@/providers/sms";
import { renderSms, type SmsTemplateTag } from "./sms-templates";

type Payload = Record<string, unknown>;
type Handler = (payload: Payload) => Promise<void>;

/** ارسال SMS و ثبت در دفتر — مشترک بین handlerها */
async function sendSms(input: {
  to: string;
  tag: SmsTemplateTag | "admin-notify";
  data: Record<string, unknown>;
  orderId?: string | null;
}): Promise<void> {
  const text = await renderSms(input.tag, input.data);
  try {
    const res = await smsProvider.send({ to: input.to, text, tag: input.tag });
    await db.smsLog.create({
      data: {
        to: input.to,
        text,
        tag: input.tag,
        status: res.ok ? "SENT" : "FAILED",
        provider: smsProvider.name,
        providerId: res.providerId ?? null,
        orderId: input.orderId ?? null,
      },
    });
  } catch (err) {
    await db.smsLog
      .create({
        data: {
          to: input.to,
          text,
          tag: input.tag,
          status: "FAILED",
          provider: smsProvider.name,
          error: err instanceof Error ? err.message.slice(0, 300) : null,
          orderId: input.orderId ?? null,
        },
      })
      .catch(() => undefined);
    throw err;
  }
}

/** شمارهٔ مشتری سفارش — payloadهای قدیمی ممکن است phone نداشته باشند */
async function orderPhone(orderId: string): Promise<string | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { phone: true },
  });
  return order?.phone ?? null;
}

/* ---------------------------- handlers ---------------------------- */

const handlers: Record<string, Handler> = {
  /** SMS تأیید ثبت سفارش — پس از checkout موفق */
  OrderCreated: async (p) => {
    const orderId = String(p.orderId ?? "");
    const to = (p.phone as string) ?? (await orderPhone(orderId));
    if (!to) return; // بدون شماره چیزی برای ارسال نیست — رخداد بسته می‌شود
    await sendSms({
      to,
      tag: "order-created",
      data: { code: p.code, grandTotal: p.grandTotal },
      orderId,
    });
  },

  /** SMS پرداخت موفق */
  PaymentSucceeded: async (p) => {
    const orderId = String(p.orderId ?? "");
    const to = await orderPhone(orderId);
    if (!to) return;
    await sendSms({
      to,
      tag: "payment-succeeded",
      data: { code: p.orderCode ?? p.code, amount: p.amount },
      orderId,
    });
  },

  /** شکست پرداخت — فعلاً فقط Analytics (بدون SMS به مشتری — §15.2) */
  PaymentFailed: async () => {
    // رزرو Analytics آینده — رخداد بدون اثر بسته می‌شود
  },

  /** SMS لغو سفارش */
  OrderCancelled: async (p) => {
    const orderId = String(p.orderId ?? "");
    const to = await orderPhone(orderId);
    if (!to) return;
    await sendSms({ to, tag: "order-cancelled", data: { code: p.code }, orderId });
  },

  /** SMS ارسال با کد رهگیری */
  OrderShipped: async (p) => {
    const orderId = String(p.orderId ?? "");
    const to = await orderPhone(orderId);
    if (!to) return;
    await sendSms({
      to,
      tag: "order-shipped",
      data: { code: p.code, trackingCode: p.trackingCode ?? null },
      orderId,
    });
  },

  /** SMS بازگشت وجه موفق */
  RefundSucceeded: async (p) => {
    const orderId = String(p.orderId ?? "");
    const to = (p.phone as string) ?? (await orderPhone(orderId));
    if (!to) return;
    await sendSms({
      to,
      tag: "refund-succeeded",
      data: { code: p.code, amount: p.amount },
      orderId,
    });
  },

  /** SMS خوش‌آمد — ثبت‌نام جدید */
  CustomerWelcome: async (p) => {
    const to = p.phone ? String(p.phone) : null;
    if (!to) return;
    await sendSms({ to, tag: "customer-welcome", data: {}, orderId: null });
  },

  /** تغییر وضعیت عمومی — مصرف‌کننده ندارد (§15.2: آینده) */
  OrderStatusChanged: async () => {},

  /** موجودی برگشت — مصرف‌کنندهٔ ایمیلی آینده */
  ProductBackInStock: async () => {},
};

export function getOutboxHandler(type: string): Handler | undefined {
  return handlers[type];
}

/** فهرست انواع پشتیبانی‌شده — برای صفحهٔ ادمین/دیباگ */
export function listOutboxHandlers(): string[] {
  return Object.keys(handlers);
}
