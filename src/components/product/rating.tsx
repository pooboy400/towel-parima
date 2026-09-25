import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

/**
 * Rating — پرامپت 32: فقط اگر Review واقعی وجود دارد نمایش داده می‌شود
 */
export function Rating({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const starSize = size === "sm" ? "size-3.5" : "size-4";
  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      aria-label={`امتیاز ${formatNumber(value)} از ۵${count ? ` با ${formatNumber(count)} نظر` : ""}`}
    >
      <div className="flex items-center gap-px" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              starSize,
              i <= Math.round(value)
                ? "fill-terracotta text-terracotta"
                : "fill-transparent text-line",
            )}
          />
        ))}
      </div>
      <span className={cn("font-medium", size === "md" ? "text-sm" : "text-xs")}>
        {formatNumber(value)}
      </span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">
          ({formatNumber(count)} نظر)
        </span>
      )}
    </div>
  );
}
