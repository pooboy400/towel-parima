"use client";

/**
 * SalesChart — نمودار روند فروش ۱۴ روز اخیر
 * ---------------------------------------------------------------
 * داده از /api/admin/dashboard/sales می‌آید (جدول Order).
 * تا راه‌اندازی فروش (M3) حالت خالی نمایش داده می‌شود — بعد خودکار زنده می‌شود.
 */

import { useEffect, useState } from "react";
import { EmptyChart } from "./charts";
import { formatNumber } from "@/lib/format";

interface SalesPoint {
  date: string;
  label: string;
  total: number;
  count: number;
}

export function ChartPlaceholder() {
  const [data, setData] = useState<SalesPoint[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/dashboard/sales", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.data) setData(j.data as SalesPoint[]);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!data) {
    return <EmptyChart message="در حال خواندن داده‌ها…" />;
  }

  const hasAny = data.some((d) => d.count > 0);
  if (!hasAny) {
    return (
      <EmptyChart message="هنوز سفارشی ثبت نشده — با راه‌اندازی فروش، نمودار اینجا زنده می‌شود" />
    );
  }

  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div>
      <div className="flex items-end gap-1.5 h-40" dir="ltr">
        {data.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.label}: ${formatNumber(d.total)} تومان (${formatNumber(d.count)} سفارش)`}>
            <div
              className="w-full max-w-7 rounded-t-md bg-[var(--color-chart-1)] group-hover:bg-[var(--color-chart-3)] transition-colors"
              style={{ height: `${Math.max(3, (d.total / max) * 100)}%`, minHeight: d.total > 0 ? 3 : 2, opacity: d.total > 0 ? 1 : 0.15 }}
            />
            <span className="text-[9px] text-stone-muted rotate-45 origin-top-right whitespace-nowrap">
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-muted mt-3">
        مجموع ۱۴ روز: {formatNumber(data.reduce((s, d) => s + d.total, 0))} تومان ·{" "}
        {formatNumber(data.reduce((s, d) => s + d.count, 0))} سفارش
      </p>
    </div>
  );
}
