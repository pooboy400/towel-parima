/**
 * Admin Schemas — Zod اسکیماهای اکشن‌های ادمین (بخش ۲.۲ سند)
 * ---------------------------------------------------------------
 * در domain هستند تا بدون server-only قابل تست باشند.
 * ارقام فارسی/عربی قیمت و موجودی با normalizeFaDigits نرمال می‌شوند.
 */

import { z } from "zod";
import { normalizeFaDigits } from "../text/normalize-fa";

/** عدد صحیح غیرمنفی با پشتیبانی ارقام فارسی — «۱٬۵۰۰» / "1500" */
const intFromFa = (message: string) =>
  z
    .string()
    .transform((v) => normalizeFaDigits(v).replace(/[٬,,\s]/g, ""))
    .refine((v) => /^\d+$/.test(v), { message })
    .transform((v) => parseInt(v, 10));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "اسلاگ فقط حروف انگلیسی کوچک، عدد و خط تیره است.");

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{3,40}$/, "SKU فقط حروف انگلیسی بزرگ، عدد و خط تیره (۳ تا ۴۰ نویسه).");

/* ------------------------------------------------------------------ */
/* محصول                                                              */
/* ------------------------------------------------------------------ */

export const variantInputSchema = z.object({
  id: z.string().optional(), // واریانت موجود (ویرایش)
  sku: skuSchema,
  price: intFromFa("قیمت باید عدد باشد."),
  compareAtPrice: intFromFa("قیمت مقایسه‌ای باید عدد باشد.").nullable().optional(),
  stock: intFromFa("موجودی باید عدد باشد."),
  colorId: z.string().nullable().optional(),
  sizeId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const productImageInputSchema = z.object({
  storageKey: z.string().min(1),
  alt: z.string().trim().max(200).optional().nullable(),
});

export const productUpsertSchema = z
  .object({
    id: z.string().optional(), // فقط در ویرایش
    name: z.string().trim().min(3, "نام محصول حداقل ۳ نویسه است.").max(120),
    slug: slugSchema,
    categoryId: z.string().min(1, "دسته‌بندی را انتخاب کنید."),
    shortDescription: z.string().trim().max(200).optional().or(z.literal("")),
    description: z.string().trim().max(8000).optional().or(z.literal("")),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    specs: z.array(z.object({ label: z.string().trim().max(60), value: z.string().trim().max(200) })).max(12).default([]),
    care: z.array(z.string().trim().max(200)).max(8).default([]),
    suitableFor: z.array(z.string().trim().max(120)).max(8).default([]),
    features: z.array(z.string().trim().max(200)).max(8).default([]),
    collectionIds: z.array(z.string()).max(12).default([]),
    sortOrder: intFromFa("ترتیب باید عدد باشد.").default(0),
    images: z.array(productImageInputSchema).max(10).default([]),
    variants: z.array(variantInputSchema).min(1, "حداقل یک واریانت لازم است.").max(80),
  })
  .refine((p) => p.variants.every((v) => !v.compareAtPrice || v.compareAtPrice > v.price), {
    message: "قیمت «قبل از تخفیف» باید از قیمت اصلی بیشتر باشد.",
    path: ["variants"],
  });

export type ProductUpsertInput = z.infer<typeof productUpsertSchema>;

/* ------------------------------------------------------------------ */
/* دسته‌بندی / کالکشن                                                  */
/* ------------------------------------------------------------------ */

export const categoryUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "نام دسته حداقل ۲ نویسه است.").max(60),
  slug: slugSchema,
  description: z.string().trim().max(500).optional().or(z.literal("")),
  seoText: z.string().trim().max(2000).optional().or(z.literal("")),
  imageKey: z.string().trim().optional().or(z.literal("")),
  sortOrder: intFromFa("ترتیب باید عدد باشد.").default(0),
});

export type CategoryUpsertInput = z.infer<typeof categoryUpsertSchema>;

export const collectionUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "نام کالکشن حداقل ۲ نویسه است.").max(60),
  slug: slugSchema,
  description: z.string().trim().max(500).optional().or(z.literal("")),
  imageKey: z.string().trim().optional().or(z.literal("")),
  sortOrder: intFromFa("ترتیب باید عدد باشد.").default(0),
  productIds: z.array(z.string()).max(40).default([]),
});

export type CollectionUpsertInput = z.infer<typeof collectionUpsertSchema>;

/* ------------------------------------------------------------------ */
/* کارکنان / حساب                                                      */
/* ------------------------------------------------------------------ */

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, "نام حداقل ۲ نویسه است.").max(60),
  email: z.string().trim().toLowerCase().email("ایمیل معتبر وارد کنید."),
  phone: z
    .string()
    .transform((v) => normalizeFaDigits(v).replace(/\D/g, ""))
    .refine((v) => /^09\d{9}$/.test(v), "شماره موبایل باید ۱۱ رقم و با 09 شروع شود."),
  password: z.string().min(10, "رمز حداقل ۱۰ کاراکتر است.").max(72),
  roleName: z.enum([
    "SUPER_ADMIN",
    "STORE_MANAGER",
    "ORDER_MANAGER",
    "CONTENT_MANAGER",
    "SUPPORT_AGENT",
    "MARKETING_MANAGER",
  ]),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "رمز فعلی را وارد کنید."),
  newPassword: z.string().min(10, "رمز جدید حداقل ۱۰ کاراکتر است.").max(72),
});
