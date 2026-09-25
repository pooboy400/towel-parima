"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LockKeyhole, Phone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { sendOtpAction, verifyOtpAction, signInWithPasswordAction } from "./actions";
import { useCartStore } from "@/store/cart-store";

/**
 * LoginForm — ورود دوگانه: رمز عبور یا کد پیامکی (§9.4).
 * شماره تازه با OTP = ساخت خودکار اکانت مشتری.
 */

type Tab = "otp" | "password";

export function LoginForm() {
  const [tab, setTab] = useState<Tab>("otp");

  return (
    <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-xl font-bold">ورود به حساب کاربری</h1>
      <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
        با شماره موبایل و کد پیامکی وارد شوید — یا با رمز عبور اگر حساب دارید.
      </p>

      {/* تب‌ها */}
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-md bg-secondary p-1" role="tablist">
        <TabButton active={tab === "otp"} onClick={() => setTab("otp")} icon={KeyRound} label="کد پیامکی" />
        <TabButton active={tab === "password"} onClick={() => setTab("password")} icon={LockKeyhole} label="رمز عبور" />
      </div>

      <div className="mt-6">
        {tab === "otp" ? <OtpLoginForm /> : <PasswordLoginForm />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-[13px] transition-colors",
        active ? "bg-surface font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* ورود با رمز                                                         */
/* ------------------------------------------------------------------ */

function PasswordLoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!phone.trim() || !password) return;
    setLoading(true);
    try {
      const res = await signInWithPasswordAction({ phone, password });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("خوش آمدید!");
      void useCartStore.getState().syncAfterLogin();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="شماره موبایل">
        <Input
          type="tel"
          dir="ltr"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0912 123 4567"
          autoComplete="username"
        />
      </Field>
      <Field label="رمز عبور">
        <Input
          type="password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </Field>
      <Button type="submit" variant="terracotta" size="lg" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LockKeyhole className="size-4" aria-hidden />}
        ورود با رمز عبور
      </Button>
      <p className="text-[11px] leading-5 text-muted-foreground">
        حساب ندارید؟ تب «کد پیامکی» را انتخاب کنید — با اولین ورود، حساب شما خودکار ساخته می‌شود.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* ورود با OTP — دو مرحله‌ای                                            */
/* ------------------------------------------------------------------ */

function OtpLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // شمارش معکوس ارسال مجدد — هر تغییر cooldown یک تایمر ساده
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const request = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await sendOtpAction({ phone });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setStep("code");
      setCode("");
      setCooldown(90);
      if (res.devCode) setDevCode(res.devCode);
      toast.success("کد تأیید ارسال شد");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const res = await verifyOtpAction({ phone, code });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.isNewAccount ? "حساب شما ساخته شد — خوش آمدید!" : "خوش آمدید!");
      void useCartStore.getState().syncAfterLogin();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {step === "phone" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void request();
          }}
        >
          <Field label="شماره موبایل">
            <Input
              type="tel"
              dir="ltr"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912 123 4567"
              autoComplete="tel"
            />
          </Field>
          <Button type="submit" variant="terracotta" size="lg" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
            دریافت کد تأیید
          </Button>
          <p className="text-[11px] leading-5 text-muted-foreground">
            اگر شماره شما در پریما ثبت نباشد، حساب کاربری شما خودکار ساخته می‌شود.
          </p>
        </form>
      ) : (
        <>
          <p className="text-[13px] leading-6 text-muted-foreground">
            کد ۶ رقمی به شماره <span dir="ltr" className="font-medium text-foreground">{faPhone(phone)}</span> پیامک شد.
          </p>

          {devCode && (
            <p className="rounded-md bg-cream p-3 text-center text-[13px]" dir="ltr">
              کد آزمایشی (فقط توسعه): <span className="font-bold">{devCode}</span>
            </p>
          )}

          <div className="flex flex-col items-center gap-4">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={loading}
              dir="ltr"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            <Button
              variant="terracotta"
              size="lg"
              className="w-full"
              onClick={() => void verify()}
              disabled={loading || code.length < 6}
            >
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Phone className="size-4" aria-hidden />}
              تأیید و ورود
            </Button>

            <div className="flex items-center gap-3 text-[13px]">
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="text-muted-foreground underline-offset-4 hover:underline"
              >
                تغییر شماره
              </button>
              <span className="text-line" aria-hidden>|</span>
              {cooldown > 0 ? (
                <span className="text-muted-foreground">
                  ارسال مجدد تا {cooldown} ثانیه
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void request()}
                  disabled={loading}
                  className="text-terracotta underline-offset-4 hover:underline"
                >
                  ارسال مجدد کد
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[13px]">{label}</Label>
      {children}
    </div>
  );
}

/** نمایش موبایل با ارقام فارسی */
function faPhone(phone: string): string {
  return phone;
}
