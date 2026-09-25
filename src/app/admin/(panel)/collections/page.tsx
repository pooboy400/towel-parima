import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { requirePageAccess } from "@/lib/admin/page-guard";
import {
  CollectionDialog,
  CollectionDeleteButton,
  TinyImage,
} from "../categories/category-manager";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  await requirePageAccess("collections");
  const [collections, products] = await Promise.all([
    db.collection.findMany({
      where: { deletedAt: null },
      include: { products: { select: { productId: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.product.findMany({
      where: { deletedAt: null, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="کالکشن‌ها"
        description={`${formatNumber(collections.length)} کالکشن منتخب`}
      />

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <p className="text-sm font-semibold">کالکشن‌های فعال</p>
          <CollectionDialog products={products} />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-muted border-b border-line">
              <th className="p-3 text-right font-medium">کالکشن</th>
              <th className="p-3 text-right font-medium">اسلاگ</th>
              <th className="p-3 text-right font-medium">محصولات</th>
              <th className="p-3 text-right font-medium">ترتیب</th>
              <th className="p-3 text-left font-medium">اقدام</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => (
              <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-cream/50">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <TinyImage src={c.imageKey} />
                    <span className="font-semibold">{c.name}</span>
                  </div>
                </td>
                <td className="p-3 text-stone-muted" dir="ltr">
                  /{c.slug}
                </td>
                <td className="p-3 tabular-nums">{formatNumber(c.products.length)}</td>
                <td className="p-3 tabular-nums">{formatNumber(c.sortOrder)}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-end">
                    <CollectionDialog
                      products={products}
                      initial={{
                        id: c.id,
                        name: c.name,
                        slug: c.slug,
                        description: c.description,
                        imageKey: c.imageKey,
                        sortOrder: c.sortOrder,
                        productIds: c.products.map((p) => p.productId),
                      }}
                    />
                    <CollectionDeleteButton id={c.id} />
                  </div>
                </td>
              </tr>
            ))}
            {collections.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-stone-muted">
                  هنوز کالکشنی ساخته نشده.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
