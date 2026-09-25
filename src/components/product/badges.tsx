import { cn } from "@/lib/utils";
import { Badge as ShadBadge } from "@/components/ui/badge";
import { discountPercent } from "@/lib/format";
import type { BadgeType } from "@/types";

/**
 * Product Badge — برچسب‌های محاسباتی خودکار (ADR 011)؛ بدون Fake scarcity
 * (تخفیف/درصد از DiscountBadge جداگانه و زنده از قیمت واقعی می‌آید)
 */
const badgeStyles: Record<BadgeType, string> = {
  new: "bg-deep text-cream",
  bestseller: "bg-secondary text-deep",
  limited: "bg-terracotta text-white",
};

const badgeLabels: Record<BadgeType, string> = {
  new: "جدید",
  bestseller: "پرفروش",
  limited: "محدود",
};

export function ProductBadge({
  type,
  className,
}: {
  type: BadgeType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium",
        badgeStyles[type],
        className,
      )}
    >
      {badgeLabels[type]}
    </span>
  );
}

/** درصد تخفیف واقعی — پرامپت 32: فقط تخفیف واقعی نمایش داده می‌شود */
export function DiscountBadge({ price, compareAtPrice }: { price: number; compareAtPrice?: number }) {
  const percent = discountPercent(price, compareAtPrice);
  if (!percent) return null;
  return (
    <span className="inline-flex items-center rounded-sm bg-destructive px-2 py-0.5 text-[11px] font-medium text-white">
      {percent}٪
    </span>
  );
}

export { ShadBadge as Badge };
