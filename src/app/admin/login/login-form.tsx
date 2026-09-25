"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLoginAction } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      const totpCode = String(formData.get("totpCode") ?? "");

      const res = await adminLoginAction({ email, password, totpCode: totpCode || undefined });
      if (res.ok) {
        toast.success("خوش آمدید! در حال انتقال به پنل…");
        const next = params.get("next") ?? res.data.next;
        router.push(next.startsWith("/admin") ? next : "/admin");
        router.refresh();
      } else {
        if (res.error.code === "TOTP_REQUIRED") {
          setNeedsTotp(true);
          setError("کد دو مرحله‌ای را از اپ Authenticator وارد کنید.");
        } else {
          setError(res.error.message);
        }
      }
    });
  }

  return (
    <div className="bg-surface rounded-3xl border border-line shadow-soft p-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="size-11 rounded-2xl bg-sand-soft text-terracotta-deep flex items-center justify-center">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="font-bold text-lg">ورود امن</h2>
          <p className="text-sm text-stone-muted">فقط حساب‌های دارای نقش مجاز به ورود هستند</p>
        </div>
      </div>

      <form action={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">ایمیل</Label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-stone-muted" />
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              className="pr-9 text-left"
              placeholder="admin@example.com"
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">رمز عبور</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-stone-muted" />
            <Input
              id="password"
              name="password"
              type="password"
              dir="ltr"
              className="pr-9 text-left"
              placeholder="••••••••••"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        {needsTotp && (
          <div className="space-y-2">
            <Label htmlFor="totpCode">کد دو مرحله‌ای (۶ رقم)</Label>
            <Input
              id="totpCode"
              name="totpCode"
              inputMode="numeric"
              dir="ltr"
              maxLength={6}
              className="text-center tracking-[0.5em]"
              placeholder="––––––"
              autoComplete="one-time-code"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full rounded-xl h-11 font-semibold">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              در حال بررسی…
            </>
          ) : (
            "ورود به پنل"
          )}
        </Button>
      </form>

      <p className="text-xs text-stone-muted mt-6 leading-relaxed">
        پس از ۵ تلاش ناموفق، ورود برای ۱۵ دقیقه مسدود می‌شود. اگر رمزتان را فراموش کرده‌اید با
        برنامه‌نویس فروشگاه تماس بگیرید.
      </p>
    </div>
  );
}
