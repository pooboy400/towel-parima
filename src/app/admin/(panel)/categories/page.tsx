import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { requirePageAccess } from "@/lib/admin/page-guard";
import {
  CategoryDialog,
  CategoryDeleteButton,
} from "./category-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requirePageAccess("categories");
  const categories = await db.category.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="دسته‌بندی‌ها"
        description={`${formatNumber(categories.length)} دسته در کاتالوگ`}
      />

      <div className="bg-surface rounded-2xl border border-line overflow-hidden mb-8">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <p className="text-sm font-semibold">دسته‌های فعال</p>
          <CategoryDialog />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-muted border-b border-line">
              <th className="p-3 text-right font-medium">نام</th>
              <th className="p-3 text-right font-medium">اسلاگ</th>
              <th className="p-3 text-right font-medium">محصولات</th>
              <th className="p-3 text-right font-medium">ترتیب</th>
              <th className="p-3 text-left font-medium">اقدام</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-cream/50">
                <td className="p-3 font-semibold">{c.name}</td>
                <td className="p-3 text-stone-muted" dir="ltr">
                  /{c.slug}
                </td>
                <td className="p-3 tabular-nums">{formatNumber(c._count.products)}</td>
                <td className="p-3 tabular-nums">{formatNumber(c.sortOrder)}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-end">
                    <CategoryDialog
                      initial={{
                        id: c.id,
                        name: c.name,
                        slug: c.slug,
                        description: c.description,
                        seoText: c.seoText,
                        imageKey: c.imageKey,
                        sortOrder: c.sortOrder,
                        productCount: c._count.products,
                      }}
                    />
                    <CategoryDeleteButton id={c.id} />
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-stone-muted">
                  هنوز دسته‌ای ساخته نشده — با دکمه «دسته جدید» شروع کنید.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
