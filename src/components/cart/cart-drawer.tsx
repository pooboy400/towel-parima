"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart-store";
import { getFreeShippingRemaining, getSubtotal, getTotals, type ShippingRates } from "@/lib/cart-logic";
import { formatPrice, faDigits } from "@/lib/format";

/**
 * Cart Drawer — پرامپت 48: پس از Add to Cart باز می‌شود، مزاحم نیست
 * Free Shipping Progress — پرامپت 49: محاسبه واقعی بر اساس مبلغ سفارش
 * نرخ‌های ارسال از Settings دیتابیس (layout → prop) می‌آید، نه ثابت کد.
 */
export function CartDrawer({
  shippingRates,
}: {
  shippingRates: ShippingRates;
}) {
  const { lines, isOpen, close, updateQuantity, removeLine } = useCartStore();
  const subtotal = getSubtotal(lines);
  const remaining = getFreeShippingRemaining(subtotal, shippingRates.freeShippingThreshold);
  const threshold = shippingRates.freeShippingThreshold;
  const progress = Math.min(100, (subtotal / threshold) * 100);
  const totals = getTotals(lines, "standard", shippingRates);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-line px-5 py-4">
          <SheetTitle className="text-base">سبد خرید</SheetTitle>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-secondary">
              <ShoppingBag className="size-7 text-muted-foreground" aria-hidden />
            </span>
            <div>
              <p className="font-medium">سبد خرید شما خالی است</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                محصولی که دوست دارید انتخاب کنید
                <br />
                و از یک تجربه نرم‌تر لذت ببرید.
              </p>
            </div>
            <Button asChild onClick={close}>
              <Link href="/shop">مشاهده محصولات</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* نوار پیشرفت ارسال رایگان */}
            <div className="border-b border-line px-5 py-3.5">
              {remaining > 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  فقط <span className="font-semibold text-foreground">{formatPrice(remaining)}</span> تا ارسال رایگان
                </p>
              ) : (
                <p className="text-[13px] font-medium text-sage">
                  ارسال سفارش شما رایگان است
                </p>
              )}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
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

            {/* آیتم‌ها */}
            <div className="flex-1 overflow-y-auto px-5">
              <ul className="flex flex-col divide-y divide-line">
                {lines.map((line) => (
                  <li key={line.lineId} className="flex gap-3.5 py-4">
                    <Link
                      href={`/product/${line.slug}`}
                      onClick={close}
                      className="relative size-20 shrink-0 overflow-hidden rounded-md bg-secondary/40"
                    >
                      <Image
                        src={line.image}
                        alt={line.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium">{line.name}</p>
                        <button
                          type="button"
                          onClick={() => removeLine(line.lineId)}
                          aria-label={`حذف ${line.name} از سبد`}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                      {(line.colorName || line.sizeLabel) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[line.colorName, line.sizeLabel].filter(Boolean).join(" · ")}
                        </p>
                      )}

                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center rounded-sm border border-line">
                          <button
                            type="button"
                            onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                            aria-label="کاهش تعداد"
                            className="flex size-8 items-center justify-center transition-colors hover:bg-secondary"
                          >
                            <Minus className="size-3.5" aria-hidden />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">
                            {faDigits(line.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                            disabled={line.quantity >= line.maxStock}
                            aria-label="افزایش تعداد"
                            className="flex size-8 items-center justify-center transition-colors hover:bg-secondary disabled:opacity-40"
                          >
                            <Plus className="size-3.5" aria-hidden />
                          </button>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatPrice(line.price * line.quantity)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* جمع‌بندی */}
            <div className="border-t border-line px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">جمع سبد</span>
                <span className="font-semibold">{formatPrice(totals.subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                هزینه ارسال در مرحله پرداخت محاسبه می‌شود
              </p>
              <div className="mt-3.5 grid grid-cols-2 gap-2">
                <Button variant="outline" asChild onClick={close}>
                  <Link href="/cart">مشاهده سبد</Link>
                </Button>
                <Button asChild onClick={close}>
                  <Link href="/checkout">تکمیل خرید</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
