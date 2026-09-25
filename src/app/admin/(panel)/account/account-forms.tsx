"use client";

/**
 * AccountForms — تغییر رمز + وضعیت 2FA (M2)
 * 2FA: زیرساخت کامل آماده است (secret/verify/otpauth) ولی طبق دستور مالک
 * تا اطلاع ثانوی «غیرفعال» است — دکمه فعال‌سازی عمداً در UI نیست.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/admin/page-header";
import { changeOwnPasswordAction } from "../staff/actions";

export function AccountForms({ name, email, totpEnabled }: {
  name: string;
  email: string;
  totpEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");

  function submit() {
    if (next !== repeat) {
      toast.error("تکرار رمز جدید مطابقت ندارد.");
      return;
    }
    startTransition(async () => {
      const res = await changeOwnPasswordAction({ currentPassword: current, newPassword: next });
      if (res.ok) {
        toast.success("رمز عوض شد. نشست‌های دیگر دستگاه‌ها بسته شدند.");
        setCurrent("");
        setNext("");
        setRepeat("");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <div className="space-y-6 max-w-xl">
      <SectionCard title="حساب شما" description="اطلاعات حساب فعلی">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-muted">نام</dt>
            <dd className="font-semibold">{name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-muted">ایمیل</dt>
            <dd dir="ltr" className="font-semibold">{email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-muted">ورود دومرحله‌ای (2FA)</dt>
            <dd className="flex items-center gap-2">
              <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${totpEnabled ? "bg-emerald-50 text-sage" : "bg-sand-soft text-terracotta-deep"}`}>
                {totpEnabled ? "فعال" : "غیرفعال"}
              </span>
              <span className="text-xs text-stone-muted flex items-center gap-1">
                <ShieldOff className="size-3.5" />
                تا فعال‌سازی شما خاموش می‌ماند
              </span>
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="تغییر رمز عبور" description="پس از تغییر، نشست‌های سایر دستگاه‌ها بسته می‌شوند">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>رمز فعلی</Label>
            <Input type="password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} className="rounded-xl text-left" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>رمز جدید</Label>
              <Input type="password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} className="rounded-xl text-left" />
            </div>
            <div className="space-y-2">
              <Label>تکرار رمز جدید</Label>
              <Input type="password" dir="ltr" value={repeat} onChange={(e) => setRepeat(e.target.value)} className="rounded-xl text-left" />
            </div>
          </div>
          <p className="text-xs text-stone-muted">حداقل ۱۰ کاراکتر — ترکیبی از حرف و رقم.</p>
          <Button onClick={submit} disabled={pending || !current || next.length < 10} className="rounded-xl">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            تغییر رمز
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
