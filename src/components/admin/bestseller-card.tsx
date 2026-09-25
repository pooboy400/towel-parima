import { Trophy, Check, Sparkles, Minus } from "lucide-react";
import { faDigits, formatNumber } from "@/lib/format";
import type { BestsellerReport } from "@/core/commerce/bestseller-service";

/**
 * BestsellerAutoCard — گزارش «پرفروش‌های خودکار» (ADR 011)
 * ---------------------------------------------------------------
 * برچسب «پرفروش» دیگر تأیید ادمین ندارد؛ سیستم از روی فروش پرداخت‌شدهٔ
 * واقعی خودش می‌زند. این کارت فقط گزارش می‌دهد — شفاف و بدون دکمه.
 */
export function BestsellerAutoCard({ report }: { report: BestsellerReport }) {
  const { windowDays, minSales, items } = report;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Sparkles className="size-6 text-sand-deep" aria-hidden />
        <p className="text-sm text-stone-muted">
          هنوز فروش پرداخت‌شده‌ای در {faDigits(windowDays)} روز اخیر نیست.
        </p>
        <p className="text-xs text-stone-muted">
          هر محصولی که به {faDigits(minSales)} عدد فروش برسد، خودکار برچسب «پرفروش» می‌گیرد.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {items.map((p) => (
          <li key={p.productId} className="py-2.5 flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sand-soft text-terracotta-deep">
              <Trophy className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block text-xs text-stone-muted">
                {formatNumber(p.soldQty)} عدد فروش واقعی در {faDigits(windowDays)} روز اخیر
              </span>
            </span>
            {p.badgeActive ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-sage/15 px-2.5 py-1 text-[11px] font-medium text-sage">
                <Check className="size-3.5" aria-hidden />
                برچسب فعال است
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[11px] text-stone-muted">
                <Minus className="size-3.5" aria-hidden />
                زیر حد ({faDigits(minSales)} عدد)
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-[11px] leading-5 text-stone-muted">
        برچسب‌ها خودکار زده می‌شوند و نیازی به تأیید شما ندارند — آستانه‌ها از تنظیمات
        فروشگاه قابل تغییر است.
      </p>
    </div>
  );
}
