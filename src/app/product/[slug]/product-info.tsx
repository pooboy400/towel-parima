"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Minus, Plus, RefreshCcw, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/product/rating";
import { DiscountBadge } from "@/components/product/badges";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { useMounted } from "@/hooks/use-mounted";
import { formatPrice, discountPercent, faDigits } from "@/lib/format";
import { LOW_STOCK_THRESHOLD } from "@/lib/config";
import type { ShippingInfoV2 } from "@/domain/schemas/settings";
import type { Product } from "@/types";

/**
 * Product Info + Buy Box — پرامپت 30 و 32
 * Name → Rating → Price → Description → Color → Size → Quantity → CTA
 * اطلاعات ارسال/مرجوعی از Settings دیتابیس (سرور → props) می‌آید.
 */
export function ProductInfo({
  product,
  shipping,
  freeShippingThreshold,
  sizeGuideHref,
}: {
  product: Product;
  shipping: ShippingInfoV2;
  freeShippingThreshold: number;
  sizeGuideHref: string;
}) {
  const [colorId, setColorId] = useState(product.colors[0]?.id);
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id);
  const [quantity, setQuantity] = useState(1);

  const addToCart = useCartStore((s) => s.addLine);
  const wishlist = useWishlistStore();
  const mounted = useMounted();
  const inWishlist = mounted && wishlist.items.includes(product.slug);

  const selectedColor = product.colors.find((c) => c.id === colorId);
  const selectedSize = product.sizes.find((s) => s.id === sizeId);
  const percent = discountPercent(product.price, product.compareAtPrice);

  const handleAddToCart = () => {
    addToCart(product, { colorId, sizeId, quantity });
    toast.success("محصول به سبد اضافه شد");
  };

  const handleWishlist = () => {
    const added = wishlist.toggle(product.slug);
    toast[added ? "success" : "message"](
      added ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد",
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* عنوان + امتیاز */}
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold leading-snug sm:text-[28px]">
          {product.name}
        </h1>
        <Rating value={product.rating} count={product.reviewCount} size="md" />
      </div>

      {/* قیمت — FE-F1 (فاز ۴): محصول ناموجود قیمت نمایش نمی‌دهد (بدون «۰ تومان») */}
      <div className="flex items-center gap-3">
        {product.stock === 0 ? (
          <span className="text-2xl font-bold text-muted-foreground">ناموجود</span>
        ) : (
          <>
            {product.compareAtPrice && percent && (
              <>
                <span className="text-base text-muted-foreground line-through">
                  {formatPrice(product.compareAtPrice, false)}
                </span>
                <DiscountBadge price={product.price} compareAtPrice={product.compareAtPrice} />
              </>
            )}
            <span className="text-2xl font-bold">{formatPrice(product.price)}</span>
          </>
        )}
      </div>

      <p className="text-[15px] leading-8 text-muted-foreground">
        {product.shortDescription}
      </p>

      <hr className="border-line" />

      {/* رنگ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            رنگ: <span className="font-medium text-muted-foreground">{selectedColor?.name}</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {product.colors.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColorId(c.id)}
              aria-pressed={colorId === c.id}
              aria-label={`رنگ ${c.name}`}
              title={c.name}
              className={cn(
                "size-9 rounded-full border transition-all",
                colorId === c.id
                  ? "border-deep ring-2 ring-deep/25 ring-offset-2 ring-offset-cream"
                  : "border-line hover:scale-105",
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {/* سایز */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            سایز:{" "}
            <span className="font-medium text-muted-foreground">
              {selectedSize
                ? `${selectedSize.label} · ${selectedSize.dimensions}${selectedSize.gsm ? ` · ${faDigits(selectedSize.gsm)} GSM` : ""}`
                : ""}
            </span>
          </h2>
          <Link
            href={sizeGuideHref}
            className="text-xs text-terracotta-deep hover:underline"
          >
            راهنمای انتخاب سایز
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {product.sizes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSizeId(s.id)}
              aria-pressed={sizeId === s.id}
              className={cn(
                "rounded-sm border px-4 py-2.5 text-[13px] transition-all",
                sizeId === s.id
                  ? "border-deep bg-deep text-cream"
                  : "border-line bg-surface hover:border-deep/40",
              )}
            >
              <span className="font-medium">{s.label}</span>
              <span className={cn("ms-1.5 text-[11px]", sizeId === s.id ? "text-cream/70" : "text-muted-foreground")}>
                {s.dimensions}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* تعداد + CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center rounded-md border border-line bg-surface">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(q + 1, product.stock))}
            disabled={quantity >= product.stock}
            aria-label="افزایش تعداد"
            className="flex size-11 items-center justify-center transition-colors hover:bg-secondary disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden />
          </button>
          <span className="w-10 text-center text-[15px] font-semibold" aria-live="polite">
            {faDigits(quantity)}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="کاهش تعداد"
            className="flex size-11 items-center justify-center transition-colors hover:bg-secondary"
          >
            <Minus className="size-4" aria-hidden />
          </button>
        </div>

        <Button
          size="lg"
          variant="terracotta"
          className="flex-1"
          onClick={handleAddToCart}
          disabled={product.stock === 0}
        >
          <ShoppingBag className="size-5" aria-hidden />
          {product.stock === 0 ? "ناموجود" : "افزودن به سبد"}
        </Button>

        <Button
          size="lg"
          variant="outline"
          onClick={handleWishlist}
          aria-pressed={inWishlist}
          aria-label="افزودن به علاقه‌مندی‌ها"
          className="sm:w-14 sm:px-0"
        >
          <Heart
            className={cn("size-5", inWishlist && "fill-terracotta text-terracotta")}
            aria-hidden
          />
        </Button>
      </div>

      {/* موجودی */}
      {product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD && (
        <p className="text-[13px] font-medium text-terracotta-deep">
          تنها {faDigits(product.stock)} عدد در انبار باقی مانده
        </p>
      )}

      {/* اطلاعات ارسال — پرامپت 36 */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4.5">
        <div className="flex items-start gap-3">
          <Truck className="mt-0.5 size-4.5 shrink-0 text-sand" aria-hidden />
          <p className="text-[13px] leading-6 text-muted-foreground">
            آماده‌سازی {shipping.preparationDays} · ارسال عادی{" "}
            {shipping.standardDays} — ارسال رایگان برای سفارش‌های بالای{" "}
            {formatPrice(freeShippingThreshold)}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <RefreshCcw className="mt-0.5 size-4.5 shrink-0 text-sand" aria-hidden />
          <p className="text-[13px] leading-6 text-muted-foreground">
            {faDigits(shipping.returnWindowDays)} روز مرجوعی و{" "}
            {faDigits(shipping.exchangeWindowDays)} روز تعویض رایگان
          </p>
        </div>
      </div>
    </div>
  );
}
