/**
 * Contact Actions — ثبت واقعی فرم تماس و خبرنامه (ADR 009)
 * Zod → rate limit per IP → ContactService → ردیف دیتابیس.
 */

"use server";

import { headers } from "next/headers";
import { rateLimiter, RATE_RULES, rateKey } from "@/core/rate-limit";
import {
  contactMessageSchema,
  newsletterSchemaZ,
  createContactMessage,
  subscribeNewsletter,
} from "@/core/commerce/contact-service";

export interface SubmitResult {
  ok: boolean;
  message: string;
  alreadySubscribed?: boolean;
}

async function requestIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

export async function submitContactAction(input: unknown): Promise<SubmitResult> {
  const parsed = contactMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." };
  }

  const ip = await requestIp();
  const rl = await rateLimiter.hit(rateKey("contact-submit", ip), RATE_RULES.contactSubmit);
  if (!rl.ok) {
    return { ok: false, message: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید." };
  }

  await createContactMessage(parsed.data);
  return { ok: true, message: "پیام شما ثبت شد؛ کارشناسان ما پاسخ می‌دهند." };
}

export async function subscribeNewsletterAction(input: unknown): Promise<SubmitResult> {
  const parsed = newsletterSchemaZ.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "ایمیل معتبر وارد کنید." };
  }

  const ip = await requestIp();
  const rl = await rateLimiter.hit(rateKey("newsletter", ip), RATE_RULES.newsletterSubscribe);
  if (!rl.ok) {
    return { ok: false, message: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید." };
  }

  const res = await subscribeNewsletter(parsed.data.email);
  return {
    ok: true,
    alreadySubscribed: res.alreadySubscribed,
    message: res.alreadySubscribed
      ? "این ایمیل از قبل عضو خبرنامه است."
      : "عضویت شما ثبت شد؛ ممنون که همراه ما هستید.",
  };
}
