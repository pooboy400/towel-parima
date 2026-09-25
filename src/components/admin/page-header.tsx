import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** سربرگ استاندارد صفحات پنل — عنوان + توضیح + اکشن اختیاری */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-stone-muted mt-1">{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="rounded-xl bg-deep text-cream px-4 py-2.5 text-sm font-semibold hover:bg-deep/90 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** کارت KPI داشبورد */
export function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "critical" | "success";
}) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-5 flex items-start gap-4">
      <span
        className={cn(
          "size-11 rounded-2xl flex items-center justify-center shrink-0",
          tone === "default" && "bg-sand-soft text-terracotta-deep",
          tone === "warning" && "bg-amber-50 text-amber-600",
          tone === "critical" && "bg-red-50 text-red-600",
          tone === "success" && "bg-emerald-50 text-sage",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-stone-muted">{title}</p>
        <p className="text-2xl font-bold tabular-nums mt-0.5">{value}</p>
        {hint && <p className="text-xs text-stone-muted mt-1">{hint}</p>}
      </div>
    </div>
  );
}

/** کارت بخش — قاب استاندارد همه بلوک‌های داشبورد و صفحات */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "bg-surface rounded-2xl border border-line p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="font-bold">{title}</h2>
          {description && <p className="text-xs text-stone-muted mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
