"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Product Gallery — پرامپت 31: Thumbnail + Main + Swipe موبایل + Counter
 */
export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex flex-col gap-3.5">
      {/* تصویر اصلی — موبایل: Swipeable */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-lg bg-secondary/30"
        dir="ltr"
      >
        <div
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollLeft / el.clientWidth);
            if (idx !== activeIndex) setActiveIndex(idx);
          }}
        >
          {images.map((src, i) => (
            <div
              key={src + i}
              className="relative h-full w-full shrink-0 snap-center"
            >
              <Image
                src={src}
                alt={`${name} — تصویر ${i + 1} از ${images.length}`}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {/* Counter موبایل */}
        <div className="pointer-events-none absolute bottom-3 start-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-deep/50 px-2.5 py-1.5 backdrop-blur lg:hidden">
          {images.map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-1.5 rounded-full bg-cream/60 transition-colors",
                i === activeIndex && "bg-cream",
              )}
            />
          ))}
        </div>
      </div>

      {/* Thumbnails — دسکتاپ */}
      {images.length > 1 && (
        <div className="hidden grid-cols-5 gap-3 lg:grid" role="tablist" aria-label="تصاویر محصول">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`نمایش تصویر ${i + 1}`}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border-2 transition-colors",
                i === activeIndex
                  ? "border-deep"
                  : "border-transparent opacity-75 hover:opacity-100",
              )}
            >
              <Image
                src={src}
                alt={`${name} — بندانگشتی ${i + 1}`}
                fill
                sizes="120px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
