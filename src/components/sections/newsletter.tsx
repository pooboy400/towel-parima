"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { newsletterSchema } from "@/lib/validations";
import { subscribeNewsletterAction } from "@/app/contact/actions";

/**
 * Newsletter — پرامپت 24
 * عضویت واقعی: ایمیل به‌عنوان ردیف ContactMessage (kind=NEWSLETTER) در دیتابیس
 * ذخیره می‌شود (ADR 009) و ادمین از /admin/messages لیست مشترکان را می‌بیند.
 */
export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = newsletterSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "ایمیل معتبر وارد کنید");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await subscribeNewsletterAction(result.data);
        if (res.ok) {
          setDone(true);
          toast.success(res.message);
        } else {
          setError(res.message);
        }
      } catch {
        setError("ثبت عضویت ناموفق بود؛ دوباره تلاش کنید.");
      }
    });
  };

  return (
    <section aria-labelledby="newsletter-title" className="pb-14 lg:pb-20">
      <div className="container-brand">
        <div className="rounded-lg border border-line bg-surface px-6 py-10 sm:px-12 lg:py-14">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-medium tracking-wide text-terracotta-deep">
                خبرنامه پریما
              </span>
              <h2 id="newsletter-title" className="text-xl font-bold sm:text-2xl">
                نکته‌های نگهداری و انتخاب، ماهی یک ایمیل
              </h2>
              <p className="text-[13px] leading-6 text-muted-foreground">
                بدون تبلیغ اضافه؛ فقط راهنماهای کوتاه برای اینکه حوله‌های‌تان
                همیشه تازه بمانند.
              </p>
            </div>

            {done ? (
              <p className="rounded-md bg-secondary px-5 py-3 text-sm font-medium text-sage">
                عضویت شما ثبت شد؛ ممنون که همراه ما هستید.
              </p>
            ) : (
              <form
                onSubmit={submit}
                noValidate
                className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  ایمیل
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(error)}
                  className="h-11 flex-1 rounded-sm border border-input bg-cream px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="h-11 shrink-0 rounded-sm bg-deep px-6 text-sm font-medium text-cream transition-colors hover:bg-deep/90 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  {pending ? "در حال ثبت…" : "عضویت"}
                </button>
              </form>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
