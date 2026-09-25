import Image from "next/image";
import Link from "next/link";
import { Droplets } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { LOW_STOCK_THRESHOLD } from "@/lib/config";
import { Rating } from "./rating";
import { ProductBadge, DiscountBadge } from "./badges";
import { CardWishlistButton, CardQuickAdd } from "./card-actions";
import type { Product } from "@/types";

/**
 * Product Card — پرامپت 28 (بهینه‌سازی Server-First)
 * ساختار: Image → Wishlist → Badge → Name → Short Desc → Rating → Price → Colors
 * این کامپوننت Server Component است: هیچ state یا store ندارند و کل کارت
 * بدون جاوااسکریپت در سرور رندر می‌شود. تعویض تصویر هاور با CSS خالص (group-hover)
 * انجام می‌شود و فقط دکمه‌های علاقه‌مندی/افزودن سریع جزیره کلاینت هستند.
 * Desktop: Hover image swap + Quick add | Mobile: بدون وابستگی به Hover
 */
export function ProductCard({
  product,
  className,
  priority = false,
}: {
  product: Product;
  className?: string;
  priority?: boolean;
}) {
  // گارد تصویر خالی — بدون تصویر، نگه‌دارندهٔ برند رندر می‌شود نه <img src="">
  const images = product.images.filter(Boolean);
  const mainImage = images[0];
  const hoverImage = images[1];
  const showDiscount = Boolean(
    product.compareAtPrice && product.compareAtPrice > product.price,
  );

  return (
    <article className={cn("group relative flex flex-col", className)}>
      {/* تصویر — تعویض هاور با CSS خالص، بدون JS */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-secondary/40">
        <Link
          href={`/product/${product.slug}`}
          aria-label={product.name}
          className="relative block h-full w-full"
        >
          {mainImage ? (
            <Image
              src={mainImage}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-opacity duration-300 group-hover:opacity-0"
              priority={priority}
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/30"
            >
              <Droplets className="size-10" />
              <span className="text-[11px] font-medium tracking-[0.3em]">پریما</span>
            </div>
          )}
          {mainImage && hoverImage && (
            <Image
              src={hoverImage}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          )}
        </Link>

        {/* Badge ها — محاسباتی خودکار (ADR 011) — حداکثر ۲ عدد */}
        <div className="pointer-events-none absolute top-3 start-3 flex flex-col items-start gap-1.5">
          {product.badges.slice(0, 2).map((b) => (
            <ProductBadge key={b} type={b} />
          ))}
          {showDiscount && (
            <DiscountBadge price={product.price} compareAtPrice={product.compareAtPrice} />
          )}
        </div>

        {/* Wishlist — جزیره کلاینت */}
        <CardWishlistButton slug={product.slug} />

        {/* Quick Add — فقط دسکتاپ */}
        <div className="absolute inset-x-3 bottom-3 hidden sm:block">
          <CardQuickAdd product={product} />
        </div>
      </div>

      {/* اطلاعات */}
      <div className="flex flex-1 flex-col gap-1.5 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-6 sm:text-[15px]">
            <Link
              href={`/product/${product.slug}`}
              className="transition-colors hover:text-terracotta-deep"
            >
              {product.name}
            </Link>
          </h3>
        </div>

        <p className="line-clamp-1 text-xs text-muted-foreground sm:text-[13px]">
          {product.shortDescription}
        </p>

        <Rating value={product.rating} count={product.reviewCount} />

        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <div className="flex flex-col">
            {showDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice!, false)}
              </span>
            )}
            <span className="text-[15px] font-semibold">
              {formatPrice(product.price)}
            </span>
          </div>

          {/* رنگ‌ها */}
          {product.colors.length > 1 && (
            <div className="flex items-center gap-1" aria-label="رنگ‌های موجود">
              {product.colors.slice(0, 4).map((c) => (
                <span
                  key={c.id}
                  title={c.name}
                  className="size-3.5 rounded-full border border-line"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {product.colors.length > 4 && (
                <span className="text-[10px] text-muted-foreground">
                  +{product.colors.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {product.stock <= LOW_STOCK_THRESHOLD && product.stock > 0 && (
          <p className="text-[11px] text-terracotta-deep">
            تنها {product.stock} عدد در انبار
          </p>
        )}
      </div>
    </article>
  );
}
