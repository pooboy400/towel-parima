/**
 * SMS Templates — قالب پیامک‌های فارسی (بخش ۱۵ سند) — M5
 * ---------------------------------------------------------------
 * متن هر پیامک از Setting فروشگاه (brandName) تغذیه می‌شود — هیچ نام
 * فروشگاهی در این فایل سفت نیست (قاعدهٔ ضد-هاردکد ADR 009).
 * اعداد داخل پیامک با ارقام لاتین ارسال می‌شوند — سازگارترین حالت با
 * همهٔ گوشی‌ها/اپراتورها (داخل متن فارسی).
 */

import { getStoreNameSafe } from "./store-name";

export type SmsTemplateTag =
  | "order-created"
  | "payment-succeeded"
  | "order-shipped"
  | "order-cancelled"
  | "refund-succeeded"
  | "customer-welcome"
  | "admin-notify";

/** جداکنندهٔ هزارگان لاتین — 1490000 → «1,490,000» */
function money(amount: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.floor(amount)));
}

/**
 * رندر قالب با دادهٔ رخداد — نام فروشگاه از DB.
 * خطای خواندن Setting نباید ارسال SMS را بشکند → fallback ایمن.
 */
export async function renderSms(
  tag: SmsTemplateTag,
  data: Record<string, unknown>,
): Promise<string> {
  const brand = await getStoreNameSafe();

  switch (tag) {
    case "order-created":
      return (
        `${brand} عزیز\n` +
        `سفارش شما با کد ${String(data.code)} ثبت شد.\n` +
        `مبلغ: ${money(Number(data.grandTotal ?? 0))} تومان\n` +
        `پنجرهٔ پرداخت تا ۲۰ دقیقه فعال است.`
      );

    case "payment-succeeded":
      return (
        `${brand} عزیز\n` +
        `پرداخت سفارش ${String(data.code)} با موفقیت انجام شد.\n` +
        `مبلغ: ${money(Number(data.amount ?? 0))} تومان\n` +
        `سفارش شما به‌زودی آماده و ارسال می‌شود. سپاس از اعتماد شما.`
      );

    case "order-shipped": {
      const tracking = data.trackingCode ? String(data.trackingCode) : null;
      return (
        `${brand} عزیز\n` +
        `سفارش ${String(data.code)} ارسال شد.\n` +
        (tracking
          ? `کد رهگیری پستی: ${tracking}\n`
          : `کد رهگیری متعاقباً برای شما ارسال می‌شود.\n`) +
        `زمان تحویل طبق رویهٔ پست، ۲ تا ۴ روز کاری.`
      );
    }

    case "order-cancelled":
      return (
        `${brand} عزیز\n` +
        `سفارش ${String(data.code)} لغو شد.\n` +
        `در صورت کسر وجه، مبلغ حداکثر تا ۷۲ ساعت به کارت شما بازمی‌گردد.\n` +
        `برای بازخرید به سایت ما سر بزنید.`
      );

    case "refund-succeeded":
      return (
        `${brand} عزیز\n` +
        `بازگشت وجه سفارش ${String(data.code)} انجام شد.\n` +
        `مبلغ: ${money(Number(data.amount ?? 0))} تومان\n` +
        `واریز طی ۲۴ تا ۷۲ ساعت کاری به کارت شما انجام می‌شود.`
      );

    case "customer-welcome":
      return (
        `به ${brand} خوش آمدید!\n` +
        `حساب شما با موفقیت ساخته شد.\n` +
        `اولین خرید خود را با اطمینان تجربه کنید — حولهٔ نخی با ضمانت اصالت پارچه.`
      );

    case "admin-notify":
      // اطلاع‌رسانی داخلی به شمارهٔ فروشگاه — متن آزاد از data.text
      return String(data.text ?? `اطلاع‌رسانی ${brand}`);
  }
}

/** برچسب فارسی هر نوع پیامک — برای ستون «نوع» در صفحهٔ ادمین */
export const SMS_TAG_LABELS: Record<string, string> = {
  "order-created": "ثبت سفارش",
  "payment-succeeded": "پرداخت موفق",
  "order-shipped": "ارسال سفارش",
  "order-cancelled": "لغو سفارش",
  "refund-succeeded": "بازگشت وجه",
  "customer-welcome": "خوش‌آمد",
  "admin-notify": "اطلاع به فروشگاه",
};
