import Image from "next/image";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { adminListProducts } from "@/lib/repositories/admin-repository";
import { db } from "@/lib/db";
import { formatNumber, formatPrice, faDigits } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard } from "@/components/admin/page-header";
import { BestsellerAutoCard } from "@/components/admin/bestseller-card";
import { getBestsellerReport } from "@/core/commerce/bestseller-service";
import { ProductRowActions, StatusBadge } from "./row-actions";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  ACTIVE: "فعال",
  ARCHIVED: "آرشیو",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requirePageAccess("products");
  const sp = await searchParams;
  const status =
    sp.status === "DRAFT" || sp.status === "ACTIVE" || sp.status === "ARCHIVED" ? sp.status : "ALL";

  const [{ items, total, page, pages }, categories, bestsellerReport] = await Promise.all([
    adminListProducts({
      query: sp.q,
      status,
      page: Number(sp.page ?? "1") || 1,
    }),
    db.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    getBestsellerReport({ limit: 3 }),
  ]);

  return (
    <div>
      <PageHeader
        title="محصولات"
        description={`${formatNumber(total)} محصول در کاتالوگ`}
        action={{ href: "/admin/products/new", label: "محصول جدید" }}
      />

      {/* پرفروش‌های خودکار — گزارش فروش واقعی؛ برچسب بدون تأیید ادمین (ADR 011) */}
      <div className="mb-6">
        <SectionCard
          title="پرفروش‌های خودکار"
          description={`بر اساس فروش پرداخت‌شدهٔ ${faDigits(bestsellerReport.windowDays)} روز اخیر — برچسب خودکار زده می‌شود`}
        >
          <BestsellerAutoCard report={bestsellerReport} />
        </SectionCard>
      </div>

      {/* فیلترها */}
      <form className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-stone-muted" />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="جستجوی نام محصول…"
            className="w-full rounded-xl border border-input bg-surface pr-9 pl-3 py-2.5 text-sm"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="rounded-xl border border-input bg-surface px-3 py-2.5 text-sm"
        >
          <option value="ALL">همه وضعیت‌ها</option>
          <option value="ACTIVE">فعال</option>
          <option value="DRAFT">پیش‌نویس</option>
          <option value="ARCHIVED">آرشیو</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-deep text-cream px-5 py-2.5 text-sm font-semibold hover:bg-deep/90"
        >
          اعمال فیلتر
        </button>
        <Link
          href="/admin/products"
          className="rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-sand-soft"
        >
          پاک‌کردن
        </Link>
      </form>

      {/* جدول */}
      <div className="bg-surface rounded-2xl border border-line overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-xs text-stone-muted border-b border-line">
              <th className="p-4 text-right font-medium">محصول</th>
              <th className="p-4 text-right font-medium">دسته</th>
              <th className="p-4 text-right font-medium">واریانت‌ها</th>
              <th className="p-4 text-right font-medium">ارزان‌ترین قیمت</th>
              <th className="p-4 text-right font-medium">موجودی آزاد</th>
              <th className="p-4 text-right font-medium">وضعیت</th>
              <th className="p-4 text-left font-medium">اقدام</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-cream/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="size-12 rounded-xl bg-sand-soft overflow-hidden shrink-0 relative">
                      {p.image && (
                        <Image src={p.image} alt="" fill className="object-cover" sizes="48px" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="font-semibold hover:text-terracotta-deep block truncate"
                      >
                        {p.name}
                      </Link>
                      <span className="text-xs text-stone-muted" dir="ltr">
                        /{p.slug}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-stone-muted">{p.categoryName ?? "—"}</td>
                <td className="p-4 tabular-nums">{formatNumber(p.variantCount)}</td>
                <td className="p-4 tabular-nums">
                  {p.minPrice != null ? formatPrice(p.minPrice) : "—"}
                </td>
                <td className="p-4 tabular-nums">
                  <span className={p.freeStock <= 10 ? "text-amber-600 font-bold" : ""}>
                    {formatNumber(p.freeStock)}
                  </span>
                </td>
                <td className="p-4">
                  <StatusBadge status={p.status} />
                </td>
                <td className="p-4 text-left">
                  <ProductRowActions id={p.id} status={p.status} />
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-stone-muted">
                  محصولی با این فیلترها پیدا نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* صفحه‌بندی */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/products?page=${p}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}${status !== "ALL" ? `&status=${status}` : ""}`}
              className={`size-9 flex items-center justify-center rounded-xl text-sm ${
                p === page ? "bg-deep text-cream font-bold" : "border border-line hover:bg-sand-soft"
              }`}
            >
              {formatNumber(p)}
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-stone-muted mt-4 flex items-center gap-2">
        <Plus className="size-3.5" />
        برای ویرایش کامل (قیمت، موجودی، تصاویر) روی نام محصول کلیک کنید.
      </p>
      <span className="hidden">{STATUS_LABELS.ACTIVE}</span>
    </div>
  );
}
