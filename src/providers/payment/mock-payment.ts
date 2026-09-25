/**
 * MockPaymentProvider — درگاه پرداخت آزمایشی (M3)
 * ---------------------------------------------------------------
 * جریان واقعی درگاه را شبیه‌سازی می‌کند: start → redirect به صفحه درگاه داخلی
 * (mock) → callback → verify. در production هرگز فعال نمی‌شود (گارد سفت).
 * M5: adapter واقعی زرین‌پال همین interface را پیاده می‌کند.
 */

import { randomBytes } from "node:crypto";
import { DomainError } from "@/core/errors";
import type {
  PaymentProvider,
  ParsedCallback,
  RefundPaymentResult,
  StartPaymentInput,
  StartPaymentResult,
  VerifyPaymentResult,
} from "./index";

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
    const authority = `MOCK-${randomBytes(12).toString("hex")}`;
    // صفحه درگاه mock داخلی — دکمه «پرداخت موفق» و «پرداخت ناموفق» دارد
    const redirectUrl = `/mock-gateway?authority=${encodeURIComponent(authority)}`;
    return { redirectUrl, authority };
  }

  async verifyPayment(input: {
    authority: string;
    amountIrt: number;
  }): Promise<VerifyPaymentResult> {
    if (process.env.NODE_ENV === "production") {
      throw new DomainError("INTERNAL", "درگاه mock در تولید غیرفعال است.");
    }
    if (!input.authority.startsWith("MOCK-")) {
      return { ok: false, code: "-11", message: "authority نامعتبر است." };
    }
    return {
      ok: true,
      code: "100",
      message: "تأیید آزمایشی درگاه mock",
      transactionId: `MOCKTX-${input.authority.slice(5)}`,
      amount: input.amountIrt,
      raw: { provider: "mock", authority: input.authority },
    };
  }

  async refundPayment(input: {
    transactionId: string;
    amountIrt: number;
  }): Promise<RefundPaymentResult> {
    if (process.env.NODE_ENV === "production") {
      throw new DomainError("INTERNAL", "درگاه mock در تولید غیرفعال است.");
    }
    return { ok: true, providerRef: `MOCKRF-${randomBytes(6).toString("hex")}` };
  }

  parseCallback(input: { searchParams: URLSearchParams }): ParsedCallback {
    const authority = input.searchParams.get("authority");
    const status = input.searchParams.get("status");
    return { authority, ok: authority !== null && status !== "NOK" };
  }

  buildResumeUrl(authority: string): string {
    return `/mock-gateway?authority=${encodeURIComponent(authority)}`;
  }
}
