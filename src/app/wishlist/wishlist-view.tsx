"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Rating } from "@/components/product/rating";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { useMounted } from "@/hooks/use-mounted";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types";

/**
 * Wishlist — پرامپت 54: Add / Remove / Move to Cart
 * محصولات از دیتای سمت سرور پاس گرفته می‌شوند.
 */
export function WishlistView({ products }: { products: Product[] }) {
  const wishlist = useWishlistStore();
  const addToCart = useCartStore((s) => s.addLine);
  const mounted = useMounted();

  const items = mounted
    ? wishlist.items
        .map((slug) => products.find((p) => p.slug === slug))
        .filter((p): p is Product => Boolean(p))
    : [];

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "علاقه‌مندی‌ها" }]} />

      <h1 className="mt-5 text-2xl font-bold sm:text-3xl">علاقه‌مندی‌ها</h1>

      {items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-5 rounded-lg border border-line bg-surface px-6 py-20 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-secondary">
            <Heart className="size-7 text-muted-foreground" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-medium">لیست علاقه‌مندی‌ها خالی است</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              محصولات مورد علاقه‌تان را با آیکون قلب ذخیره کنید
              <br />
              تا بعداً راحت پیداشان کنید.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link href="/shop">مشاهده محصولات</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <li
              key={product.id}
              className="flex gap-4 rounded-lg border border-line bg-surface p-4"
            >
              <Link
                href={`/product/${product.slug}`}
                className="relative size-24 shrink-0 overflow-hidden rounded-md bg-secondary/40"
              >
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/product/${product.slug}`}
                  className="truncate text-sm font-medium transition-colors hover:text-terracotta-deep"
                >
                  {product.name}
                </Link>
                <Rating value={product.rating} count={product.reviewCount} />
                <span className="mt-1 text-sm font-semibold">
                  {formatPrice(product.price)}
                </span>

                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      addToCart(product, {
                        colorId: product.colors[0]?.id,
                        sizeId: product.sizes[0]?.id,
                      })
                    }
                    className="flex-1"
                  >
                    <ShoppingBag className="size-4" aria-hidden />
                    افزودن به سبد
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      wishlist.remove(product.slug);
                      toast("از علاقه‌مندی‌ها حذف شد");
                    }}
                    aria-label={`حذف ${product.name}`}
                    className="flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
