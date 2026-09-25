"use client";

/**
 * StaffManager — لیست کارکنان + ایجاد + غیرفعال‌سازی + reset رمز (M2)
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, PowerOff, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createStaffAction, setUserActiveAction, resetStaffPasswordAction } from "./actions";

interface StaffRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleTitle: string;
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
}

export function StaffManager({
  users,
  roles,
}: {
  users: StaffRow[];
  roles: { name: string; title: string; permissionCount: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    roleName: "CONTENT_MANAGER",
  });

  function createStaff() {
    startTransition(async () => {
      const res = await createStaffAction(form);
      if (res.ok) {
        toast.success("حساب ساخته شد. رمز را شخصاً به همکارتان بگویید.");
        setOpen(false);
        setForm({ name: "", email: "", phone: "", password: "", roleName: "CONTENT_MANAGER" });
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  function toggleActive(u: StaffRow) {
    startTransition(async () => {
      const res = await setUserActiveAction({ id: u.id, isActive: !u.isActive });
      if (res.ok) {
        toast.success(u.isActive ? "حساب غیرفعال شد و نشست‌هایش بسته شد." : "حساب فعال شد.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  function resetPassword() {
    if (!resetTarget) return;
    startTransition(async () => {
      const res = await resetStaffPasswordAction({ id: resetTarget.id, newPassword });
      if (res.ok) {
        toast.success("رمز ریست شد و همه نشست‌های او بسته شد.");
        setResetTarget(null);
        setNewPassword("");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* کارکنان */}
      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <p className="text-sm font-semibold">حساب‌های پنل</p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl">
                <UserPlus className="size-4" />
                کارمند جدید
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle>ایجاد حساب کارمند</DialogTitle>
                <DialogDescription>فقط نقش‌های تعریف‌شده دسترسی می‌گیرند</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>نام *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>ایمیل *</Label>
                    <Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl text-left" />
                  </div>
                  <div className="space-y-2">
                    <Label>موبایل *</Label>
                    <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl text-left" placeholder="09xxxxxxxxx" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>رمز عبور (حداقل ۱۰ کاراکتر) *</Label>
                  <Input dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-xl text-left" />
                </div>
                <div className="space-y-2">
                  <Label>نقش *</Label>
                  <select
                    value={form.roleName}
                    onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                    className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm"
                  >
                    {roles.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.title} ({r.permissionCount} مجوز)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter className="flex-row-reverse gap-2">
                <Button onClick={createStaff} disabled={pending} className="rounded-xl">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : "ایجاد حساب"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-muted border-b border-line">
              <th className="p-3 text-right font-medium">کاربر</th>
              <th className="p-3 text-right font-medium">نقش</th>
              <th className="p-3 text-right font-medium">آخرین ورود</th>
              <th className="p-3 text-right font-medium">وضعیت</th>
              <th className="p-3 text-left font-medium">اقدام</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-cream/50">
                <td className="p-3">
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-xs text-stone-muted" dir="ltr">
                    {u.email} · {u.phone}
                  </p>
                </td>
                <td className="p-3">{u.roleTitle}</td>
                <td className="p-3 text-stone-muted whitespace-nowrap">{u.lastLoginAt}</td>
                <td className="p-3">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      u.isActive ? "bg-emerald-50 text-sage" : "bg-red-50 text-red-600"
                    }`}
                  >
                    {u.isActive ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      title="ریست رمز"
                      onClick={() => setResetTarget(u)}
                      className="size-8 rounded-lg hover:bg-sand-soft flex items-center justify-center"
                    >
                      <KeyRound className="size-4" />
                    </button>
                    {u.isActive && (
                      <button
                        type="button"
                        title="غیرفعال‌سازی"
                        onClick={() => toggleActive(u)}
                        disabled={pending}
                        className="size-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"
                      >
                        <PowerOff className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* نقش‌ها */}
      <div className="bg-surface rounded-2xl border border-line p-5">
        <p className="text-sm font-semibold mb-4 flex items-center gap-2">
          <ShieldCheck className="size-4 text-terracotta-deep" />
          نقش‌های سیستمی
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.name} className="rounded-xl border border-line p-4">
              <p className="font-semibold text-sm">{r.title}</p>
              <p className="text-xs text-stone-muted mt-1" dir="ltr">
                {r.name}
              </p>
              <p className="text-xs mt-2">{r.permissionCount} مجوز</p>
            </div>
          ))}
        </div>
      </div>

      {/* دیالوگ ریست رمز */}
      <Dialog open={Boolean(resetTarget)} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ریست رمز {resetTarget?.name}</DialogTitle>
            <DialogDescription>همه نشست‌های فعال او بسته می‌شود</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>رمز جدید (حداقل ۱۰ کاراکتر)</Label>
            <Input dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl text-left" />
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={resetPassword} disabled={pending || newPassword.length < 10} className="rounded-xl">
              ریست کن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
