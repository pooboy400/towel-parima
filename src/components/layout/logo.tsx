import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * لوگوی پریما — علامت مینیمال «تای تا شده» + وردمارک
 */
export function Logo({
  className,
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  const textColor = variant === "dark" ? "text-deep" : "text-cream";
  return (
    <Link
      href="/"
      aria-label="پریما — صفحه اصلی"
      className={cn("flex items-center gap-2.5", className)}
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        {/* سه لایه حوله تاشده */}
        <rect x="4" y="6" width="26" height="6.5" rx="2.5" fill="var(--color-terracotta)" />
        <rect x="4" y="14" width="26" height="6.5" rx="2.5" fill="var(--color-sand)" />
        <rect x="4" y="22" width="26" height="6.5" rx="2.5" fill={variant === "dark" ? "#303A35" : "#F8F6F2"} />
      </svg>
      <span className={cn("flex flex-col leading-none", textColor)}>
        <span className="text-lg font-bold tracking-tight">پریما</span>
        <span className="mt-0.5 text-[9px] font-medium tracking-[0.35em] opacity-60">
          PRIMA
        </span>
      </span>
    </Link>
  );
}
