import { Suspense } from "react";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { ProductGrid } from "@/components/product/product-grid";
import type { Category, Product, ProductFilters } from "@/types";
import type { FilterFacets } from "@/services/product-service";
import { FiltersSidebar, FiltersToolbar } from "./filters";
import { faDigits } from "@/lib/format";

/**
 * ShopView — نمای مشترک /shop و /shop/[category]
 * پرامپت 42: Breadcrumb → Title → Description → Count → Filters → Sort → Grid
 */
export function ShopView({
  products,
  total,
  categories,
  activeCategory,
  filters,
  searchQuery,
  seoText,
  titleOverride,
  descriptionOverride,
  facets,
  breadcrumbOverride,
}: {
  products: Product[];
  total: number;
  categories: Category[];
  activeCategory: Category | null;
  filters: ProductFilters;
  searchQuery?: string;
  seoText?: string;
  titleOverride?: string;
  descriptionOverride?: string;
  facets?: FilterFacets;
  /** مسیر کامل breadcrumb — پیش‌فرض خانه>فروشگاه (رفع گمراه‌کنندگی کالکشن‌ها، 47-e) */
  breadcrumbOverride?: { label: string; href?: string }[];
}) {
  const title = titleOverride ?? (searchQuery ? `نتایج جستجوی «${searchQuery}»` : (activeCategory?.name ?? "فروشگاه حوله"));
  const description =
    descriptionOverride ??
    activeCategory?.description ??
    "حوله‌هایی با تمرکز بر کیفیت، نرمی و تجربه‌ای که هر روز لمس می‌کنید.";

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb
        items={
          breadcrumbOverride ?? [
            { label: "خانه", href: "/" },
            { label: "فروشگاه", href: "/shop" },
            ...(activeCategory ? [{ label: activeCategory.name }] : []),
            ...(searchQuery ? [{ label: `«${searchQuery}»` }] : []),
          ]
        }
      />

      <header className="mt-6 flex flex-col gap-2.5">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-10">
        {/* فیلتر دسکتاپ */}
        <Suspense fallback={<div className="hidden lg:block" />}>
          <div className="hidden lg:block">
            <FiltersSidebar
              categories={categories}
              activeCategory={activeCategory?.slug ?? null}
              filters={filters}
              facets={facets}
            />
          </div>
        </Suspense>

        <div>
          {/* Toolbar — موبایل: فیلتر+مرتب‌سازی | دسکتاپ: شمارنده+مرتب‌سازی */}
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-[13px] text-muted-foreground">
              {faDigits(total)} محصول
            </p>
            <Suspense fallback={null}>
              <FiltersToolbar categories={categories} activeCategory={activeCategory?.slug ?? null} filters={filters} facets={facets} />
            </Suspense>
          </div>

          <ProductGrid products={products} />

          {/* متن SEO صفحه دسته — پرامپت 109 */}
          {seoText && (
            <div className="mt-14 rounded-lg border border-line bg-surface p-6">
              <h2 className="text-[15px] font-semibold">
                راهنمای انتخاب {activeCategory?.name}
              </h2>
              <p className="mt-2.5 text-[13px] leading-7 text-muted-foreground">
                {seoText}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
