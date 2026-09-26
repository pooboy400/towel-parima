"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { useCartStore } from "@/store/cart-store";
import { getTotals, getFreeShippingRemaining, type ShippingRates } from "@/lib/cart-logic";
import { formatPrice, faDigits } from "@/lib/format";

/**
 * Cart View (Client) — پرامپت 47: سبد بسیار ساده + Summary کامل
 * نرخ‌های ارسال از Settings دیتابیس (صفحهٔ سرور → prop) می‌آید؛
 * هم‌جهت با چک‌اوت و دروازهٔ سروری.
 */
export function CartView({ shippingRates }: { shippingRates: ShippingRates }) {
  const { lines, updateQuantity, removeLine } = useCartStore();
  const totals = getTotals(lines, "standard", shippingRates);
  const remaining = getFreeShippingRemaining(
    totals.subtotal,
    shippingRates.freeShippingThreshold,
  );
  const threshold = shippingRates.freeShippingThreshold;
  const progress = Math.min(100, (totals.subtotal / threshold) * 100);
  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبد خرید" }]} />

      <h1 className="mt-5 text-2xl font-bold sm:text-3xl">سبد خرید</h1>

      {lines.length === 0 ? (
        /* Empty State — پرامپت 117 */
        <div className="flex flex-col items-center gap-5 rounded-lg border border-line bg-surface px-6 py-20 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-secondary">
            <ShoppingBag className="size-7 text-muted-foreground" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-medium">سبد خرید شما خالی است</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              محصولی که دوست دارید انتخاب کنید
              <br />
              و از یک تجربه نرم‌تر لذت ببرید.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link href="/shop">مشاهده محصولات</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          {/* آیتم‌ها */}
          <div className="flex flex-col gap-0 rounded-lg border border-line bg-surface">
            {/* نوار ارسال رایگان */}
            <div className="border-b border-line px-5 py-4">
              {remaining > 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  فقط{" "}
                  <span className="font-semibold text-foreground">
                    {formatPrice(remaining)}
                  </span>{" "}
                  تا ارسال رایگان
                </p>
              ) : (
                <p className="text-[13px] font-medium text-sage">
                  ارسال سفارش شما رایگان است
                </p>
              )}
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-terracotta transition-all duration-500"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>

            <ul className="flex flex-col divide-y divide-line">
              {lines.map((line) => (
                <li key={line.lineId} className="flex gap-4 p-5">
                  <Link
                    href={`/product/${line.slug}`}
                    className="relative size-24 shrink-0 overflow-hidden rounded-md bg-secondary/40 sm:size-28"
                  >
                    <Image
                      src={line.image}
                      alt={line.name}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/product/${line.slug}`}
                          className="text-[15px] font-medium transition-colors hover:text-terracotta-deep"
                        >
                          {line.name}
                        </Link>
                        {(line.colorName || line.sizeLabel) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[line.colorName, line.sizeLabel].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.lineId)}
                        aria-label={`حذف ${line.name} از سبد`}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-4.5" aria-hidden />
                      </button>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center rounded-sm border border-line">
                        <button
                          type="button"
                          onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                          aria-label="کاهش تعداد"
                          className="flex size-9 items-center justify-center transition-colors hover:bg-secondary"
                        >
                          <Minus className="size-3.5" aria-hidden />
                        </button>
                        <span className="w-9 text-center text-sm font-medium">
                          {faDigits(line.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                          disabled={line.quantity >= line.maxStock}
                          aria-label="افزایش تعداد"
                          className="flex size-9 items-center justify-center transition-colors hover:bg-secondary disabled:opacity-40"
                        >
                          <Plus className="size-3.5" aria-hidden />
                        </button>
                      </div>
                      <div className="flex flex-col items-end">
                        {line.compareAtPrice && line.compareAtPrice > line.price && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(line.compareAtPrice * line.quantity, false)}
                          </span>
                        )}
                        <span className="text-[15px] font-semibold">
                          {formatPrice(line.price * line.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* جمع‌بندی — پرامپت 47 */}
          <aside className="h-fit rounded-lg border border-line bg-surface p-6 lg:sticky lg:top-24">
            <h2 className="text-[15px] font-semibold">جمع‌بندی سفارش</h2>
            <dl className="mt-5 flex flex-col gap-3.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">جمع کالاها</dt>
                <dd className="font-medium">{formatPrice(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex items-center justify-between">
                  {/* UX-04 (فاز ۴): این ردیف «تخفیف فاکتور» نیست — سود قیمت مصوب
                      است و در مبلغ قابل پرداخت اثر ندارد؛ برچسب صادقانه + رنگ مثبت */}
                  <dt className="text-muted-foreground">سود شما از قیمت مصوب</dt>
                  <dd className="font-medium text-sage">
                    {formatPrice(totals.discount)}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">هزینه ارسال</dt>
                <dd className="font-medium">
                  {totals.shipping === 0 ? (
                    <span className="text-sage">رایگان</span>
                  ) : (
                    formatPrice(totals.shipping)
                  )}
                </dd>
              </div>
              <div className="border-t border-line pt-3.5">
                <div className="flex items-center justify-between">
                  <dt className="font-semibold">مبلغ قابل پرداخت</dt>
                  <dd className="text-lg font-bold">{formatPrice(totals.total)}</dd>
                </div>
              </div>
            </dl>

            <Button size="lg" variant="terracotta" asChild className="mt-6 w-full">
              <Link href="/checkout">ادامه فرایند پرداخت</Link>
            </Button>
            <Button variant="ghost" asChild className="mt-2 w-full">
              <Link href="/shop">ادامه خرید</Link>
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
