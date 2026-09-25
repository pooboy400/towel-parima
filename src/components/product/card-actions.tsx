"use client";

import { Heart, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlistStore } from "@/store/wishlist-store";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";
import type { Product } from "@/types";

/**
 * جزایر کلاینت کارت محصول — بهینه‌سازی Server-First
 * کارت اصلی (product-card.tsx) یک Server Component است و فقط این دو دکمه
 * به state مرورگر (علاقه‌مندی/سبد) نیاز دارند؛ بقیه کارت بدون جاوااسکریپت رندر می‌شود.
 * فاز ۲: همین جزایر با اتصال به API کار می‌کنند (toggle در سرور + optimistic UI).
 */

export function CardWishlistButton({ slug }: { slug: string }) {
  const mounted = useMounted();
  const toggle = useWishlistStore((s) => s.toggle);
  const rawInWishlist = useWishlistStore((s) => s.items.includes(slug));
  const inWishlist = mounted && rawInWishlist;

  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-label={inWishlist ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      aria-pressed={inWishlist}
      className="absolute top-2.5 end-2.5 flex size-9 items-center justify-center rounded-full bg-surface/85 text-foreground backdrop-blur transition-all duration-200 hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring/50 sm:opacity-0 sm:group-hover:opacity-100"
    >
      <Heart
        className={cn(
          "size-4 transition-colors",
          inWishlist && "fill-terracotta text-terracotta",
        )}
      />
    </button>
  );
}

export function CardQuickAdd({ product }: { product: Product }) {
  const addToCart = useCartStore((s) => s.addLine);

  const quickAdd = () => {
    addToCart(product, {
      colorId: product.colors[0]?.id,
      sizeId: product.sizes[0]?.id,
      quantity: 1,
    });
  };

  return (
    <button
      type="button"
      onClick={quickAdd}
      className="flex h-10 w-full translate-y-2 items-center justify-center gap-2 rounded-sm bg-deep/90 text-sm font-medium text-cream opacity-0 backdrop-blur transition-all duration-200 hover:bg-deep focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:translate-y-0 group-hover:opacity-100"
    >
      <ShoppingBag className="size-4" aria-hidden />
      افزودن سریع به سبد
    </button>
  );
}
