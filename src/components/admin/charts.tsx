"use client";

/**
 * Charts — نمودارهای سبک SVG پنل (M2)
 * ---------------------------------------------------------------
 * - بدون وابستگی جدید: SVG خالص با پالت برند (--color-chart-1..5)
 * - RTL-native: میله‌ها از راست رشد می‌کنند، اعداد فارسی
 * - tooltip بومی مرورگر با <title> — ساده و در دسترس
 */

import { useId } from "react";
import { cn } from "@/lib/utils";

const fa = (n: number) => new Intl.NumberFormat("fa-IR").format(n);

/* ------------------------------------------------------------------ */
/* میله‌ای افقی — مثلاً موجودی بر اساس دسته                             */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  value: number;
}

export function HorizontalBarChart({
  data,
  color = "var(--color-chart-1)",
  emptyMessage = "داده‌ای برای نمایش نیست",
}: {
  data: BarDatum[];
  color?: string;
  emptyMessage?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) {
    return <EmptyChart message={emptyMessage} />;
  }
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={d.label} className="group">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-ink/90">{d.label}</span>
            <span className="text-stone-muted tabular-nums">{fa(d.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-sand-soft/70 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: color,
                opacity: 1 - (i % 5) * 0.08,
              }}
              role="img"
              aria-label={`${d.label}: ${fa(d.value)}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* دونات — سهم دسته‌ای/وضعیت‌ها                                        */
/* ------------------------------------------------------------------ */

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  emptyMessage = "داده‌ای برای نمایش نیست",
}: {
  data: DonutDatum[];
  centerLabel?: string;
  centerValue?: string;
  emptyMessage?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <EmptyChart message={emptyMessage} />;

  const R = 54;
  const C = 2 * Math.PI * R;
  // پیش‌محاسبه سگمنت‌ها — تجمیع بدون متغیر جهش‌یاب
  const segments = data.reduce<{ key: string; dash: number; offset: number; color: string; label: string; value: number }[]>(
    (list, d) => {
      const prev = list[list.length - 1];
      const offset = prev ? prev.offset + prev.dash : 0;
      list.push({
        key: `${uid}-${d.label}`,
        dash: (d.value / total) * C,
        offset,
        color: d.color,
        label: d.label,
        value: d.value,
      });
      return list;
    },
    [],
  );

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="size-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-sand-soft)" strokeWidth="16" />
        {segments.map((seg) => (
          <circle
            key={seg.key}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeDasharray={`${seg.dash} ${C - seg.dash}`}
            strokeDashoffset={-seg.offset}
            strokeLinecap="butt"
          >
            <title>{`${seg.label}: ${fa(seg.value)}`}</title>
          </circle>
        ))}
        {(centerValue || centerLabel) && (
          <g className="rotate-90 origin-center">
            <text
              x="70"
              y="66"
              textAnchor="middle"
              className="fill-ink"
              style={{ fontSize: 18, fontWeight: 700 }}
            >
              {centerValue}
            </text>
            <text
              x="70"
              y="84"
              textAnchor="middle"
              className="fill-stone-muted"
              style={{ fontSize: 9 }}
            >
              {centerLabel}
            </text>
          </g>
        )}
      </svg>
      <ul className="space-y-2.5 min-w-0 flex-1">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-3 rounded-sm shrink-0"
              style={{ backgroundColor: d.color }}
              aria-hidden
            />
            <span className="flex-1 truncate text-ink/90">{d.label}</span>
            <span className="text-stone-muted tabular-nums text-xs">
              {fa(d.value)}
              {total > 0 && ` (${fa(Math.round((d.value / total) * 100))}٪)`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* حالت خالی                                                          */
/* ------------------------------------------------------------------ */

export function EmptyChart({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        "h-40 flex flex-col items-center justify-center text-center text-sm text-stone-muted",
        className,
      )}
    >
      <svg viewBox="0 0 64 40" className="w-16 h-10 mb-2 opacity-40" aria-hidden>
        <rect x="4" y="24" width="10" height="12" rx="2" fill="currentColor" />
        <rect x="20" y="14" width="10" height="22" rx="2" fill="currentColor" opacity=".5" />
        <rect x="36" y="20" width="10" height="16" rx="2" fill="currentColor" opacity=".7" />
        <rect x="52" y="8" width="10" height="28" rx="2" fill="currentColor" opacity=".3" />
      </svg>
      {message}
    </div>
  );
}
