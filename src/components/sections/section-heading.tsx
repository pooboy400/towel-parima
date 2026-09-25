import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

/**
 * Section Heading — ریتم تایپوگرافیک ثابت در همه بخش‌ها
 * Overline کوچک + عنوان + لینک اختیاری «مشاهده همه»
 */
export function SectionHeading({
  overline,
  title,
  description,
  linkHref,
  linkLabel,
  align = "start",
  className,
}: {
  overline?: string;
  title: string;
  description?: string;
  linkHref?: string;
  linkLabel?: string;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-2", align === "center" && "items-center text-center")}>
        {overline && (
          <span className="text-xs font-medium tracking-wide text-terracotta-deep">
            {overline}
          </span>
        )}
        <h2 className="text-2xl font-bold leading-snug sm:text-[28px]">{title}</h2>
        {description && (
          <p className="max-w-xl text-sm leading-7 text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {linkHref && (
        <Link
          href={linkHref}
          className="group flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
        >
          {linkLabel ?? "مشاهده همه"}
          <ArrowLeft
            className="size-4 transition-transform duration-200 group-hover:-translate-x-1"
            aria-hidden
          />
        </Link>
      )}
    </div>
  );
}
