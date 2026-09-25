/**
 * SmsProvider — abstraction پیامک (بخش ۱۹ سند)
 * M4: فقط Mock (console) — M5: کاوه‌نگار/ملی‌پیامک با همان interface.
 */

export interface SmsSendInput {
  to: string;
  text: string;
  /** برچسب برای لاگ/مسیریابی آینده */
  tag?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(input: SmsSendInput): Promise<{ ok: true; providerId: string | null }>;
}

import { MockSmsProvider } from "./mock-sms";

/** singleton فعال — انتخاب با env (M5: case "kavenegar") */
export const smsProvider: SmsProvider = (() => {
  switch (process.env.SMS_PROVIDER ?? "mock") {
    case "mock":
    default:
      return new MockSmsProvider();
  }
})();
