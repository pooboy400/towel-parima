"use client";

import { useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import type { Category, ColorOption, ProductFilters } from "@/types";
import type { FilterFacets } from "@/services/product-service";

/**
 * رنگ/سایز فیلتر از دیتابیس (Color/Size) می‌آید — سرور facet را می‌فرستد.
 * آرایهٔ ثابت زیر فقط fallback ایمن است (مثلاً وقتی DB در دسترس نیست).
 */
const FALLBACK_COLORS: ColorOption[] = [
  { id: "cream", name: "کرم", hex: "#F5F0E6" },
  { id: "white", name: "سفید", hex: "#FAFAF7" },
  { id: "beige", name: "بژ", hex: "#D9CBB6" },
  { id: "sand", name: "شنی", hex: "#C3A98C" },
  { id: "taupe", name: "خاکستری گرم", hex: "#A69B8D" },
  { id: "stone", name: "سنگی", hex: "#8C8A85" },
  { id: "mint", name: "سبز ملایم", hex: "#C9DCD0" },
  { id: "sage", name: "سبز مریم‌گلی", hex: "#9DB4A5" },
];

const FALLBACK_SIZES = [
  { id: "bath-large", label: "حمام بزرگ (۹۰×۱۵۰)" },
  { id: "bath", label: "حمام (۷۰×۱۴۰)" },
  { id: "hand", label: "دست و صورت (۳۵×۷۵)" },
  { id: "pool", label: "استخری (۹۰×۱۸۰)" },
  { id: "guest", label: "مهمان (۴۰×۶۰)" },
  { id: "kids", label: "کودک (۶۰×۱۲۰)" },
  { id: "travel", label: "مسافرتی (۵۰×۹۰)" },
];

const PRICE_PRESETS = [
  { label: "تا ۵۰۰ هزار تومان", from: undefined, to: 500_000 },
  { label: "۵۰۰ هزار تا ۱ میلیون", from: 500_000, to: 1_000_000 },
  { label: "۱ تا ۲ میلیون تومان", from: 1_000_000, to: 2_000_000 },
  { label: "بالای ۲ میلیون تومان", from: 2_000_000, to: undefined },
];

const RATING_OPTIONS = [
  { value: 4.5, label: "۴.۵ به بالا" },
  { value: 4, label: "۴ به بالا" },
];

/**
 * هوک مشترک: مدیریت فیلترها از طریق URL — قابل اشتراک و SSR-friendly
 */
function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = useCallback(
    (mutate: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(searchParams.toString());
      mutate(sp);
      startTransition(() => {
        router.replace(pathname + (sp.toString() ? `?${sp}` : ""), {
          scroll: false,
        });
      });
    },
    [router, pathname, searchParams],
  );

  const toggleMulti = (key: string, value: string) => {
    setParams((sp) => {
      const current = (sp.get(key) ?? "").split(",").filter(Boolean);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (next.length) sp.set(key, next.join(","));
      else sp.delete(key);
    });
  };

  const setSingle = (key: string, value?: string) => {
    setParams((sp) => {
      if (value) sp.set(key, value);
      else sp.delete(key);
    });
  };

  return { setParams, toggleMulti, setSingle, isPending };
}

function useClearAll() {
  const { setParams } = useFilterParams();
  return () =>
    setParams((sp) => {
      ["color", "size", "priceFrom", "priceTo", "rating", "available"].forEach(
        (k) => sp.delete(k),
      );
    });
}

/**
 * Sidebar فیلتر — دسکتاپ
 */
export function FiltersSidebar({
  categories,
  activeCategory,
  filters,
  facets,
}: {
  categories: Category[];
  activeCategory: string | null;
  filters: ProductFilters;
  facets?: FilterFacets;
}) {
  const { setParams, toggleMulti, setSingle } = useFilterParams();
  const clearAll = useClearAll();

  const activeCount = countActive(filters);

  return (
    <aside aria-label="فیلتر محصولات">
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-semibold">فیلترها</span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="size-3.5" aria-hidden />
            حذف همه
          </button>
        )}
      </div>

      <Section title="دسته‌بندی">
        <ul className="flex flex-col gap-0.5">
          <li>
            <a
              href="/shop"
              className={cn(
                "block rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-secondary",
                !activeCategory && "bg-secondary font-medium",
              )}
            >
              همه محصولات
            </a>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <a
                href={`/shop/${c.slug}`}
                className={cn(
                  "block rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-secondary",
                  activeCategory === c.slug && "bg-secondary font-medium",
                )}
              >
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="قیمت">
        <div className="flex flex-col gap-1">
          {PRICE_PRESETS.map((p) => {
            const active =
              filters.priceFrom === p.from && filters.priceTo === p.to;
            return (
              <CheckItem
                key={p.label}
                checked={active}
                label={p.label}
                onChange={() =>
                  setParams((sp) => {
                    if (active) {
                      sp.delete("priceFrom");
                      sp.delete("priceTo");
                    } else {
                      if (p.from) sp.set("priceFrom", String(p.from));
                      else sp.delete("priceFrom");
                      if (p.to) sp.set("priceTo", String(p.to));
                      else sp.delete("priceTo");
                    }
                  })
                }
              />
            );
          })}
        </div>
      </Section>

      <Section title="رنگ">
        <div className="flex flex-wrap gap-2.5">
          {(facets?.colors ?? FALLBACK_COLORS).map((c) => {
            const active = filters.colors?.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleMulti("color", c.id)}
                title={c.name}
                aria-pressed={Boolean(active)}
                aria-label={c.name}
                className={cn(
                  "size-7 rounded-full border transition-all",
                  active
                    ? "border-deep ring-2 ring-deep/30 ring-offset-2 ring-offset-cream"
                    : "border-line hover:scale-110",
                )}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </Section>

      <Section title="سایز">
        <div className="flex flex-col gap-0.5">
          {(facets?.sizes ?? FALLBACK_SIZES).map((s) => (
            <CheckItem
              key={s.id}
              checked={filters.sizes?.includes(s.id) ?? false}
              label={s.label}
              onChange={() => toggleMulti("size", s.id)}
            />
          ))}
        </div>
      </Section>

      <Section title="امتیاز">
        <div className="flex flex-col gap-0.5">
          {RATING_OPTIONS.map((r) => (
            <CheckItem
              key={r.value}
              checked={filters.minRating === r.value}
              label={r.label}
              onChange={() =>
                setSingle("rating", filters.minRating === r.value ? undefined : String(r.value))
              }
            />
          ))}
        </div>
      </Section>

      <Section title="موجودی">
        <CheckItem
          checked={filters.onlyAvailable ?? false}
          label="فقط کالاهای موجود"
          onChange={() => setSingle("available", filters.onlyAvailable ? undefined : "1")}
        />
      </Section>
    </aside>
  );
}

/**
 * Toolbar — موبایل: دکمه فیلتر (Sheet) | دسکتاپ: فقط مرتب‌سازی
 */
export function FiltersToolbar({
  categories,
  activeCategory,
  filters,
  facets,
}: {
  categories: Category[];
  activeCategory: string | null;
  filters: ProductFilters;
  facets?: FilterFacets;
}) {
  const { setSingle } = useFilterParams();
  const clearAll = useClearAll();
  const activeCount = countActive(filters);

  return (
    <div className="flex items-center gap-2">
      {/* دکمه فیلتر — فقط موبایل */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 lg:hidden">
            <SlidersHorizontal className="size-4" aria-hidden />
            فیلتر
            {activeCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-terracotta text-[11px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="flex h-[85vh] flex-col rounded-t-xl p-0"
        >
          <SheetHeader className="border-b border-line px-5 py-4">
            <SheetTitle className="text-base">فیلترها</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <FiltersSidebar
              categories={categories}
              activeCategory={activeCategory}
              filters={filters}
              facets={facets}
            />
          </div>
          <div className="border-t border-line p-4">
            <SheetClose asChild>
              <Button className="w-full">مشاهده نتایج</Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      {/* مرتب‌سازی — هر دو */}
      <label className="flex items-center gap-2 text-[13px]">
        <span className="hidden text-muted-foreground sm:inline">مرتب‌سازی:</span>
        <select
          value={filters.sort ?? "popular"}
          onChange={(e) =>
            setSingle("sort", e.target.value === "popular" ? undefined : e.target.value)
          }
          className="h-9 rounded-sm border border-line bg-surface px-2.5 outline-none transition-colors focus-visible:border-ring"
          aria-label="مرتب‌سازی محصولات"
        >
          <option value="popular">محبوب‌ترین</option>
          <option value="newest">جدیدترین</option>
          <option value="price-asc">قیمت: کم به زیاد</option>
          <option value="price-desc">قیمت: زیاد به کم</option>
          <option value="rating">بیشترین امتیاز</option>
        </select>
      </label>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="hidden text-xs text-muted-foreground transition-colors hover:text-destructive lg:block"
        >
          حذف فیلترها
        </button>
      )}
    </div>
  );
}

function countActive(filters: ProductFilters): number {
  return (
    (filters.colors?.length ?? 0) +
    (filters.sizes?.length ?? 0) +
    (filters.priceFrom !== undefined || filters.priceTo !== undefined ? 1 : 0) +
    (filters.minRating !== undefined ? 1 : 0) +
    (filters.onlyAvailable ? 1 : 0)
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line py-5 first:pt-0">
      <h3 className="mb-3.5 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function CheckItem({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: React.ReactNode;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-sm py-1.5 text-[13px] transition-colors hover:text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 rounded-sm accent-[#303A35]"
      />
      {label}
    </label>
  );
}
