import { z } from "zod";

/**
 * Validation Schemas — پرامپت 146: schema validation با Zod
 * در فاز 2 همین اسکیماها در API Routeهای بک‌اند هم استفاده می‌شوند.
 */

const phoneRegex = /^09\d{9}$/;

export const addressSchema = z.object({
  firstName: z.string().min(2, "نام را وارد کنید"),
  lastName: z.string().min(2, "نام خانوادگی را وارد کنید"),
  phone: z
    .string()
    .transform((v) => v.replace(/\u06F0-\u06F9/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))))
    .pipe(
      z
        .string()
        .regex(phoneRegex, "شماره موبایل معتبر نیست (مثال: 09121234567)"),
    ),
  province: z.string().min(2, "استان را وارد کنید"),
  city: z.string().min(2, "شهر را وارد کنید"),
  postalCode: z
    .string()
    .regex(/^\d{10}$/, "کد پستی ۱۰ رقمی است"),
  address: z.string().min(10, "آدرس کامل‌تر وارد کنید"),
  note: z.string().max(300, "یادداشت حداکثر ۳۰۰ کاراکتر است").optional(),
});

export type AddressSchema = z.infer<typeof addressSchema>;

export const contactFormSchema = z.object({
  name: z.string().min(2, "نام خود را وارد کنید"),
  email: z.string().email("ایمیل معتبر وارد کنید"),
  subject: z.string().min(2, "موضوع پیام را بنویسید"),
  message: z.string().min(10, "متن پیام حداقل ۱۰ کاراکتر باشد"),
});

export type ContactFormSchema = z.infer<typeof contactFormSchema>;

export const newsletterSchema = z.object({
  email: z.string().email("ایمیل معتبر وارد کنید"),
});
