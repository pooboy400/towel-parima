"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgePercent, Check, CreditCard, MapPin, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/store/cart-store";
import { getTotals } from "@/lib/cart-logic";
import { formatPrice, faDigits } from "@/lib/format";
import { addressSchema } from "@/lib/validations";
import { PROVINCES } from "@/lib/provinces";
import { placeOrderAction, validateCouponAction } from "./actions";
import type { ShippingMethod } from "@/types";
import type { ShippingRates } from "@/lib/cart-logic";
import type { ShippingInfoV2 } from "@/domain/schemas/settings";

/**
 * Checkout Client — سه مرحله: اطلاعات و آدرس → ارسال → پرداخت.
 * مشتری لاگین: آدرس‌های ذخیره‌شده برای انتخاب/پیش‌پر کردن (M4).
 * ثبت سفارش با Server Action تراکنشی؛ قیمت/موجودی سمت سرور اعتبارسنجی می‌شود.
 * نرخ‌ها و زمان‌بندی ارسال از Settings دیتابیس (سرور → props) می‌آید، نه ثابت کد.
 */
export interface CheckoutSavedAddress {
  id: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  line: string;
  isDefault: boolean;
}

const STEPS = [
  { id: 1, label: "اطلاعات و آدرس", icon: MapPin },
  { id: 2, label: "ارسال", icon: Truck },
  { id: 3, label: "پرداخت", icon: CreditCard },
];

export function CheckoutClient({
  savedAddresses = [],
  shippingRates,
  shippingDays,
}: {
  savedAddresses?: CheckoutSavedAddress[];
  shippingRates: ShippingRates;
  shippingDays: ShippingInfoV2;
}) {
  const router = useRouter();
  const { lines, clear } = useCartStore();
  const [step, setStep] = useState(1);
  const [shipping, setShipping] = useState<ShippingMethod>("standard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    savedAddresses.find((a) => a.isDefault)?.id ?? null,
  );
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [form, setForm] = useState(() => {
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    return {
      firstName: def ? def.fullName.split(" ")[0] ?? "" : "",
      lastName: def ? def.fullName.split(" ").slice(1).join(" ") : "",
      phone: def?.phone ?? "",
      province: def?.province ?? "تهران",
      city: def?.city ?? "",
      postalCode: def?.postalCode ?? "",
      address: def?.line ?? "",
      note: "",
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totals = useMemo(
    () => getTotals(lines, shipping, shippingRates),
    [lines, shipping, shippingRates],
  );

  const payable = Math.max(0, totals.subtotal - (couponDiscount ?? 0)) + totals.shipping;

  const setField = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  /** پرکردن فرم از یک آدرس ذخیره‌شده */
  const applySavedAddress = (a: CheckoutSavedAddress) => {
    setSelectedAddressId(a.id);
    setForm((f) => ({
      ...f,
      firstName: a.fullName.split(" ")[0] ?? "",
      lastName: a.fullName.split(" ").slice(1).join(" "),
      phone: a.phone,
      province: a.province,
      city: a.city,
      postalCode: a.postalCode,
      address: a.line,
    }));
    setErrors({});
  };

  const validateStep = () => {
    const result = addressSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return false;
    }
    return true;
  };

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponChecking(true);
    try {
      const res = await validateCouponAction({
        code,
        lines: lines.map((l) => ({ lineId: l.lineId, quantity: l.quantity, name: l.name })),
      });
      if (res.ok) {
        setCouponDiscount(res.discount);
        toast.success(`کد تخفیف اعمال شد — ${formatPrice(res.discount)} تخفیف`);
      } else {
        setCouponDiscount(null);
        toast.error(res.message);
      }
    } finally {
      setCouponChecking(false);
    }
  };

  const submitOrder = async () => {
    setIsSubmitting(true);
    try {
      const res = await placeOrderAction({
        lines: lines.map((l) => ({ lineId: l.lineId, quantity: l.quantity })),
        address: {
          fullName: `${form.firstName} ${form.lastName}`.trim(),
          phone: form.phone,
          province: form.province,
          city: form.city,
          postalCode: form.postalCode,
          line: form.address,
        },
        shippingMethod: shipping,
        couponCode: couponDiscount !== null && couponCode.trim() ? couponCode.trim() : null,
        note: form.note || null,
      });

      if (!res.ok) {
        toast.error(res.message);
        setIsSubmitting(false);
        return;
      }
      // سبد بعد از پرداخت موفق پاک می‌شود (جزیره ClearCartOnMount در صفحه موفقیت)
      router.push(res.redirectUrl);
    } catch {
      toast.error("ثبت سفارش ناموفق بود — اتصال خود را بررسی کنید.");
      setIsSubmitting(false);
    }
  };

  if (lines.length === 0) {
    return (
      <div className="container-brand py-16 text-center">
        <h1 className="text-xl font-bold">سبد خرید شما خالی است</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          برای تکمیل خرید، ابتدا محصولی به سبد اضافه کنید.
        </p>
        <Button asChild className="mt-6">
          <Link href="/shop">مشاهده محصولات</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container-brand py-8 lg:py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">تکمیل خرید</h1>

      {/* مراحل */}
      <ol className="mt-6 flex items-center gap-2 text-[13px]" aria-label="مراحل خرید">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-line sm:w-10" aria-hidden />}
            <span
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-2 transition-colors",
                step === s.id && "bg-deep text-cream font-medium",
                step > s.id && "text-sage",
                step < s.id && "text-muted-foreground",
              )}
            >
              {step > s.id ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <s.icon className="size-4" aria-hidden />
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        {/* فرم */}
        <div className="rounded-lg border border-line bg-surface p-6">
          {/* مرحله ۱: اطلاعات و آدرس */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-[15px] font-semibold">اطلاعات گیرنده</h2>

              {/* انتخاب سریع از آدرس‌های ذخیره‌شده (M4) */}
              {savedAddresses.length > 0 && (
                <fieldset className="flex flex-col gap-2 rounded-md border border-line p-4">
                  <legend className="px-1 text-[12px] text-muted-foreground">
                    آدرس‌های ذخیره‌شده
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {savedAddresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => applySavedAddress(a)}
                        aria-pressed={selectedAddressId === a.id}
                        className={cn(
                          "max-w-full truncate rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                          selectedAddressId === a.id
                            ? "border-deep bg-cream font-medium"
                            : "border-line hover:border-deep/40",
                        )}
                      >
                        {a.province}، {a.city} — {a.fullName}
                        {a.isDefault && (
                          <span className="ms-1.5 rounded-full bg-deep px-1.5 py-0.5 text-[10px] text-cream">
                            پیش‌فرض
                          </span>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressId(null);
                        setForm((f) => ({
                          ...f,
                          firstName: "",
                          lastName: "",
                          phone: "",
                          province: "تهران",
                          city: "",
                          postalCode: "",
                          address: "",
                        }));
                      }}
                      aria-pressed={selectedAddressId === null}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                        selectedAddressId === null
                          ? "border-deep bg-cream font-medium"
                          : "border-line text-muted-foreground hover:border-deep/40",
                      )}
                    >
                      آدرس دیگری می‌نویسم
                    </button>
                  </div>
                </fieldset>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="نام" error={errors.firstName}>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    placeholder="مثال: سارا"
                    aria-invalid={Boolean(errors.firstName)}
                  />
                </Field>
                <Field label="نام خانوادگی" error={errors.lastName}>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    placeholder="مثال: محمدی"
                    aria-invalid={Boolean(errors.lastName)}
                  />
                </Field>
                <Field label="شماره موبایل" error={errors.phone} hint="برای هماهنگی ارسال">
                  <Input
                    type="tel"
                    dir="ltr"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="0912 123 4567"
                    aria-invalid={Boolean(errors.phone)}
                  />
                </Field>
                <Field label="استان">
                  <select
                    value={form.province}
                    onChange={(e) => setField("province", e.target.value)}
                    className="h-9 w-full rounded-sm border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring"
                  >
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="شهر" error={errors.city}>
                  <Input
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                    placeholder="مثال: تهران"
                    aria-invalid={Boolean(errors.city)}
                  />
                </Field>
                <Field label="کد پستی" error={errors.postalCode}>
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    value={form.postalCode}
                    onChange={(e) => setField("postalCode", e.target.value)}
                    placeholder="۱۹۶۵۸۴۳۱۱۱"
                    aria-invalid={Boolean(errors.postalCode)}
                  />
                </Field>
              </div>

              <Field label="آدرس کامل" error={errors.address}>
                <Textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="خیابان، کوچه، پلاک، واحد"
                  aria-invalid={Boolean(errors.address)}
                />
              </Field>

              <Field label="یادداشت سفارش (اختیاری)">
                <Textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setField("note", e.target.value)}
                  placeholder="مثال: بسته‌بندی هدیه و کارت تبریک"
                />
              </Field>

              <Button
                size="lg"
                className="self-start"
                onClick={() => validateStep() && setStep(2)}
              >
                ادامه به روش ارسال
              </Button>
            </div>
          )}

          {/* مرحله ۲: ارسال */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-[15px] font-semibold">روش ارسال</h2>
              <div className="flex flex-col gap-3">
                <ShippingOption
                  selected={shipping === "standard"}
                  onSelect={() => setShipping("standard")}
                  title="ارسال عادی"
                  description={`تحویل ${shippingDays.standardDays} — پست پیشتاز`}
                  price={totals.subtotal >= shippingRates.freeShippingThreshold ? 0 : shippingRates.standardShippingCost}
                />
                <ShippingOption
                  selected={shipping === "express"}
                  onSelect={() => setShipping("express")}
                  title="ارسال اکسپرس"
                  description={`تحویل ${shippingDays.expressDays} — پیک ویژه تهران`}
                  price={shippingRates.expressShippingCost}
                />
              </div>
              <div className="flex gap-3 self-start">
                <Button variant="outline" onClick={() => setStep(1)}>
                  بازگشت
                </Button>
                <Button onClick={() => setStep(3)}>ادامه به پرداخت</Button>
              </div>
            </div>
          )}

          {/* مرحله ۳: مرور و پرداخت */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <h2 className="text-[15px] font-semibold">مرور سفارش</h2>

              <div className="flex flex-col gap-3 rounded-md bg-cream p-4 text-[13px] leading-6">
                <p>
                  <span className="font-medium">گیرنده:</span>{" "}
                  {form.firstName} {form.lastName} — {form.phone}
                </p>
                <p>
                  <span className="font-medium">آدرس:</span>{" "}
                  {form.province}، {form.city}، {form.address}
                </p>
                <p>
                  <span className="font-medium">ارسال:</span>{" "}
                  {shipping === "express" ? `اکسپرس (${shippingDays.expressDays})` : `عادی (${shippingDays.standardDays})`}
                </p>
              </div>

              {/* کد تخفیف */}
              <div className="flex flex-col gap-2 rounded-md border border-line p-4">
                <Label className="flex items-center gap-1.5 text-[13px]">
                  <BadgePercent className="size-4 text-sage" aria-hidden />
                  کد تخفیف (اختیاری)
                </Label>
                <div className="flex gap-2">
                  <Input
                    dir="ltr"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value);
                      setCouponDiscount(null);
                    }}
                    placeholder="کد تخفیف"
                    disabled={couponDiscount !== null}
                  />
                  {couponDiscount !== null ? (
                    <Button variant="outline" onClick={() => { setCouponDiscount(null); setCouponCode(""); }}>
                      حذف
                    </Button>
                  ) : (
                    <Button onClick={applyCoupon} disabled={couponChecking || !couponCode.trim()}>
                      {couponChecking ? "بررسی…" : "اعمال"}
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  مبلغ نهایی بر اساس قواعد سروری محاسبه می‌شود.
                </p>
              </div>

              <p className="flex items-start gap-2 text-[13px] leading-6 text-muted-foreground">
                <PackageCheck className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
                با ثبت سفارش، شرایط بازگشت کالا و قوانین فروشگاه را می‌پذیرید.
              </p>

              <div className="flex gap-3 self-start">
                <Button variant="outline" onClick={() => setStep(2)}>
                  بازگشت
                </Button>
                <Button
                  variant="terracotta"
                  size="lg"
                  onClick={submitOrder}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "در حال ثبت سفارش…" : "پرداخت و ثبت سفارش"}
                </Button>
              </div>
              {isSubmitting && (
                <p className="text-[13px] text-muted-foreground">
                  در حال پردازش پرداخت… لطفاً صفحه را نبندید.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Order Summary — همیشه قابل مشاهده */}
        <aside className="h-fit rounded-lg border border-line bg-surface p-6 lg:sticky lg:top-24">
          <h2 className="text-[15px] font-semibold">خلاصه سفارش</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {lines.map((line) => (
              <li key={line.lineId} className="flex items-center gap-3">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-secondary/40">
                  <Image src={line.image} alt="" fill sizes="56px" className="object-cover" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-medium">{line.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {faDigits(line.quantity)} × {formatPrice(line.price, false)}
                    {line.colorName ? ` · ${line.colorName}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-medium">
                  {formatPrice(line.price * line.quantity, false)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 flex flex-col gap-3 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">جمع کالاها</dt>
              <dd>{formatPrice(totals.subtotal)}</dd>
            </div>
            {couponDiscount !== null && couponDiscount > 0 && (
              <div className="flex justify-between text-sage">
                <dt>تخفیف ({couponCode.toUpperCase()})</dt>
                <dd>−{formatPrice(couponDiscount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">ارسال</dt>
              <dd>
                {totals.shipping === 0 ? (
                  <span className="text-sage">رایگان</span>
                ) : (
                  formatPrice(totals.shipping)
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3">
              <dt className="font-semibold">مبلغ قابل پرداخت</dt>
              <dd className="text-lg font-bold">{formatPrice(payable)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[13px]">{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ShippingOption({
  selected,
  onSelect,
  title,
  description,
  price,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  price: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border p-4 text-start transition-all",
        selected ? "border-deep bg-cream" : "border-line hover:border-deep/40",
      )}
    >
      <span className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-4.5 items-center justify-center rounded-full border-2",
            selected ? "border-deep" : "border-line",
          )}
          aria-hidden
        >
          {selected && <span className="size-2 rounded-full bg-deep" />}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium">{title}</span>
          <span className="mt-0.5 text-xs text-muted-foreground">{description}</span>
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold">
        {price === 0 ? (
          <span className="text-sage">رایگان</span>
        ) : (
          formatPrice(price)
        )}
      </span>
    </button>
  );
}
