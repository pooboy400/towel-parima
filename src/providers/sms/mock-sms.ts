/**
 * MockSmsProvider — پیامک آزمایشی (فقط dev)
 * کد OTP در کنسول سرور چاپ می‌شود؛ در production اجازه کار ندارد (گارد سفت).
 */

import { DomainError } from "@/core/errors";
import type { SmsProvider, SmsSendInput } from "./index";

export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";

  async send(input: SmsSendInput): Promise<{ ok: true; providerId: string | null }> {
    if (process.env.NODE_ENV === "production") {
      throw new DomainError("INTERNAL", "سرویس پیامک mock در تولید غیرفعال است.");
    }
    console.log(
      JSON.stringify({
        level: "info",
        provider: "mock-sms",
        to: input.to,
        tag: input.tag ?? null,
        text: input.text,
        at: new Date().toISOString(),
      }),
    );
    return { ok: true, providerId: `mock-${Date.now()}` };
  }
}
