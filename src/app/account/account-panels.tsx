"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, MapPin, Package, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPrice, faDigits } from "@/lib/format";
import { PROVINCES } from "@/lib/provinces";
import { useCartStore } from "@/store/cart-store";
import {
  logoutAction,
  createAddressAction,
  updateAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from "./actions";

/* ------------------------------------------------------------------ */
/* سفارش‌های من                                                        */
/* ------------------------------------------------------------------ */

export interface AccountOrder {
  id: string;
  code: string;
  status: string;
  statusFa: string;
  grandTotal: number;
  itemCount: number;
  placedAt: string;
}

export function OrdersPanel({ orders }: { orders: AccountOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-14 text-center">
        <Package className="size-10 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-[15px] font-semibold">هنوز سفارشی ثبت نکرده‌اید</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            اولین خرید خود را انجام دهید — سفارش‌ها اینجا نمایش داده می‌شوند.
          </p>
        </div>
        <Button asChild variant="terracotta">
          <Link href="/shop">مشاهده محصولات</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <Link
          key={o.id}
          href={`/order-tracking?code=${encodeURIComponent(o.code)}`}
          className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-deep/40"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold" dir="ltr">
              سفارش {faDigits(o.code)}
            </span>
            <span className="text-xs text-muted-foreground">
              {faDigits(new Date(o.placedAt).toLocaleDateString("fa-IR"))} ·{" "}
              {faDigits(o.itemCount)} قلم
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[13px] font-bold">{formatPrice(o.grandTotal)}</span>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
              {o.statusFa}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* دفترچه آدرس                                                         */
/* ------------------------------------------------------------------ */

export interface AccountAddress {
  id: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  line: string;
  isDefault: boolean;
}

export function AddressesPanel({ addresses }: { addresses: AccountAddress[] }) {
  return (
    <div className="flex flex-col gap-3">
      <AddressDialog
        trigger={
          <Button variant="terracotta" className="self-start">
            <Plus className="size-4" aria-hidden />
            افزودن آدرس جدید
          </Button>
        }
      />

      {addresses.map((a) => (
        <div
          key={a.id}
          className={cn(
            "flex flex-col gap-3 rounded-lg border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between",
            a.isDefault ? "border-deep/50" : "border-line",
          )}
        >
          <div className="flex flex-col gap-1 text-[13px] leading-6">
            <span className="flex items-center gap-2 font-semibold">
              {a.fullName}
              {a.isDefault && (
                <span className="flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] text-sand-deep">
                  <Star className="size-3 fill-current" aria-hidden />
                  پیش‌فرض
                </span>
              )}
            </span>
            <span dir="ltr" className="text-muted-foreground">{faDigits(a.phone)}</span>
            <span className="text-muted-foreground">
              {a.province}، {a.city}، {a.line} — کد پستی {faDigits(a.postalCode)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {!a.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void setDefaultAddressAction(a.id).then((r) =>
                    r.ok ? toast.success("آدرس پیش‌فرض شد") : toast.error(r.message),
                  )
                }
              >
                <Star className="size-4" aria-hidden />
                پیش‌فرض کن
              </Button>
            )}
            <AddressDialog
              address={a}
              trigger={
                <Button variant="ghost" size="sm" aria-label={`ویرایش آدرس ${a.fullName}`}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
              }
            />
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              aria-label={`حذف آدرس ${a.fullName}`}
              onClick={() => {
                if (confirm("این آدرس حذف شود؟")) {
                  void deleteAddressAction(a.id).then((r) =>
                    r.ok ? toast.success("آدرس حذف شد") : toast.error(r.message),
                  );
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ))}

      {addresses.length === 0 && (
        <p className="rounded-lg border border-dashed border-line px-6 py-8 text-center text-[13px] text-muted-foreground">
          هنوز آدرسی ذخیره نکرده‌اید — برای تکمیل سریع‌تر خرید، آدرس اضافه کنید.
        </p>
      )}
    </div>
  );
}

/** دیالوگ افزودن/ویرایش آدرس */
function AddressDialog({
  address,
  trigger,
}: {
  address?: AccountAddress;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, startTransition] = useTransition();
  const [form, setForm] = useState({
    fullName: address?.fullName ?? "",
    phone: address?.phone ?? "",
    province: address?.province ?? "تهران",
    city: address?.city ?? "",
    postalCode: address?.postalCode ?? "",
    line: address?.line ?? "",
    isDefault: address?.isDefault ?? false,
  });

  const save = () => {
    startTransition(async () => {
      const res = address
        ? await updateAddressAction(address.id, form)
        : await createAddressAction(form);
      if (res.ok) {
        toast.success(address ? "آدرس ویرایش شد" : "آدرس ذخیره شد");
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{address ? "ویرایش آدرس" : "آدرس جدید"}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام گیرنده">
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="مثال: سارا محمدی"
              />
            </Field>
            <Field label="شماره موبایل">
              <Input
                type="tel"
                dir="ltr"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="0912 123 4567"
              />
            </Field>
            <Field label="استان">
              <select
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                className="h-9 w-full rounded-sm border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring"
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="شهر">
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="مثال: تهران"
              />
            </Field>
            <Field label="کد پستی">
              <Input
                dir="ltr"
                inputMode="numeric"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                placeholder="۱۹۶۵۸۴۳۱۱۱"
              />
            </Field>
          </div>
          <Field label="نشانی کامل">
            <Textarea
              rows={3}
              value={form.line}
              onChange={(e) => setForm((f) => ({ ...f, line: e.target.value }))}
              placeholder="خیابان، کوچه، پلاک، واحد"
            />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              className="size-4 accent-[var(--deep)]"
            />
            این آدرس پیش‌فرض من باشد
          </label>
          <Button type="submit" variant="terracotta" disabled={saving} className="self-start">
            <MapPin className="size-4" aria-hidden />
            {saving ? "در حال ذخیره…" : "ذخیره آدرس"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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

/* ------------------------------------------------------------------ */
/* پروفایل + خروج                                                      */
/* ------------------------------------------------------------------ */

export function ProfilePanel({
  customer,
}: {
  customer: { name: string | null; phone: string | null; passwordSet: boolean };
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const logout = () => {
    startTransition(async () => {
      const res = await logoutAction();
      if (res.ok) {
        useCartStore.getState().setCustomer(null);
        router.push("/");
        // کش سمت کلاینت کاملاً تازه شود — سبد/نشست قبلی پاک بماند
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-col gap-2 text-[13px] leading-6">
        <p className="flex items-center gap-2">
          <Phone className="size-4 text-muted-foreground" aria-hidden />
          <span dir="ltr">{faDigits(customer.phone ?? "—")}</span>
        </p>
        <p className="text-muted-foreground">
          {customer.name ? "نام: " + customer.name : "نام ثبت نشده — در آدرس‌ها می‌توانید نام گیرنده را وارد کنید."}
        </p>
        <p className="text-muted-foreground">
          {customer.passwordSet
            ? "حساب شما با رمز عبور هم محافظت می‌شود."
            : "برای حساب شما رمز عبور ثبت نشده — ورود با کد پیامکی فعال است."}
        </p>
      </div>
      <Button
        variant="outline"
        className="self-start text-destructive"
        onClick={logout}
        disabled={pending}
      >
        <LogOut className="size-4" aria-hidden />
        خروج از حساب
      </Button>
    </div>
  );
}
