"use client";

import { useState } from "react";
import { toast } from "sonner";
import { contactFormSchema, type ContactFormSchema } from "@/lib/validations";
import { submitContactAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormValues = ContactFormSchema;
type FieldErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

/**
 * فرم تماس — اعتبارسنجی کلاینت با Zod، سپس Server Action واقعی:
 * پیام به‌عنوان ردیف ContactMessage در دیتابیس ذخیره می‌شود (ADR 009)
 * و ادمین از /admin/messages آن را می‌بیند.
 */
export function ContactForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function setField(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    // پاک‌کردن خطای فیلد هنگام تایپ
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = contactFormSchema.safeParse(values);

    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await submitContactAction(result.data);
      if (res.ok) {
        toast.success(res.message);
        setValues(initialValues);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("ارسال پیام ناموفق بود؛ دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-6 flex flex-col gap-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {/* نام */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-name">نام و نام خانوادگی</Label>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            placeholder="مثلاً سارا محمدی"
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name && (
            <p id="contact-name-error" className="text-xs text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        {/* ایمیل */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-email">ایمیل</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email && (
            <p id="contact-email-error" className="text-xs text-destructive">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      {/* موضوع */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-subject">موضوع</Label>
        <Input
          id="contact-subject"
          name="subject"
          placeholder="مثلاً سؤال درباره‌ی سایز حوله"
          value={values.subject}
          onChange={(e) => setField("subject", e.target.value)}
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? "contact-subject-error" : undefined}
        />
        {errors.subject && (
          <p id="contact-subject-error" className="text-xs text-destructive">
            {errors.subject}
          </p>
        )}
      </div>

      {/* متن پیام */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-message">متن پیام</Label>
        <Textarea
          id="contact-message"
          name="message"
          rows={6}
          placeholder="هر چه دوست دارید برای‌مان بنویسید…"
          value={values.message}
          onChange={(e) => setField("message", e.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
        />
        {errors.message && (
          <p id="contact-message-error" className="text-xs text-destructive">
            {errors.message}
          </p>
        )}
      </div>

      <Button type="submit" variant="terracotta" size="lg" className="self-start" disabled={submitting}>
        {submitting ? "در حال ارسال…" : "ارسال پیام"}
      </Button>
    </form>
  );
}
