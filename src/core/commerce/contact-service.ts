/**
 * Contact Service — ذخیرهٔ واقعی پیام‌های فرم تماس و عضویت خبرنامه (ADR 009)
 * ---------------------------------------------------------------
 * جایگزین «توست فیک» فاز ۱: هر ثبت یک ردیف ContactMessage در دیتابیس است
 * که ادمین از /admin/messages می‌بیند. UI هرگز به کلاینت اعتماد نمی‌کند؛
 * Zod در مرز اکشن + rate limit per IP (بخش ۹.۴ سند).
 */
import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "نام حداقل ۲ نویسه است.").max(80),
  email: z.string().trim().email("ایمیل معتبر وارد کنید.").max(160),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9,10}$/, "شماره موبایل معتبر وارد کنید.")
    .optional()
    .or(z.literal("")),
  subject: z.string().trim().min(2).max(120),
  message: z
    .string()
    .trim()
    .min(10, "پیام حداقل ۱۰ نویسه است.")
    .max(2000, "پیام حداکثر ۲۰۰۰ نویسه است."),
});

export const newsletterSchemaZ = z.object({
  email: z.string().trim().email("ایمیل معتبر وارد کنید.").max(160),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

/** ثبت پیام فرم تماس — ردیف جدید NEW */
export async function createContactMessage(input: ContactMessageInput) {
  const row = await db.contactMessage.create({
    data: {
      kind: "CONTACT",
      email: input.email,
      name: input.name,
      phone: input.phone || null,
      subject: input.subject,
      message: input.message,
    },
  });
  return { id: row.id };
}

/**
 * عضویت خبرنامه — idempotent: ایمیل تکراری خطا نمی‌دهد
 * (خروجی همان تجربهٔ کاربری، بدون ردیف تکراری)
 */
export async function subscribeNewsletter(email: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await db.contactMessage.findFirst({
    where: { kind: "NEWSLETTER", email: normalized },
    select: { id: true },
  });
  if (existing) return { id: existing.id, alreadySubscribed: true };
  const row = await db.contactMessage.create({
    data: { kind: "NEWSLETTER", email: normalized },
  });
  return { id: row.id, alreadySubscribed: false };
}
