import { PageHeader } from "@/components/admin/page-header";
import { adminListAudit } from "@/lib/repositories/admin-repository";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "auth.login.success": "ورود موفق",
  "auth.login.failed": "ورود ناموفق",
  "auth.login.rate_limited": "ورود محدودشده",
  "auth.logout": "خروج",
  "product.create": "ایجاد محصول",
  "product.update": "ویرایش محصول",
  "product.delete": "حذف محصول",
  "product.status.update": "تغییر وضعیت محصول",
  "inventory.adjust": "تنظیم موجودی",
  "category.create": "ایجاد دسته",
  "category.update": "ویرایش دسته",
  "category.delete": "حذف دسته",
  "collection.create": "ایجاد کالکشن",
  "collection.update": "ویرایش کالکشن",
  "collection.delete": "حذف کالکشن",
  "journal.create": "ایجاد مقاله",
  "journal.update": "ویرایش مقاله",
  "journal.delete": "حذف مقاله",
  "faq.create": "ایجاد سوال",
  "faq.update": "ویرایش سوال",
  "faq.delete": "حذف سوال",
  "review.moderate": "بررسی نظر",
  "media.upload": "آپلود رسانه",
  "media.delete": "حذف رسانه",
  "settings.update": "تغییر تنظیمات",
  "user.create": "ایجاد کاربر",
  "user.status.update": "تغییر وضعیت کاربر",
  "user.password.reset": "ریست رمز",
  "user.password.change": "تغییر رمز",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { items, total, page, pages } = await adminListAudit({
    action: sp.action,
    page: Number(sp.page ?? "1") || 1,
  });

  return (
    <div>
      <PageHeader
        title="دفتر رویدادها"
        description={`${total} رویداد ثبت‌شده — append-only: هیچ رکوردی قابل ویرایش یا حذف نیست`}
      />

      {/* فیلتر اکشن */}
      <form className="flex flex-wrap gap-3 mb-6">
        <select
          name="action"
          defaultValue={sp.action ?? ""}
          className="rounded-xl border border-input bg-surface px-3 py-2.5 text-sm min-w-56"
        >
          <option value="">همه رویدادها</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-deep text-cream px-5 py-2.5 text-sm font-semibold">
          فیلتر
        </button>
        <a href="/admin/audit" className="rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-sand-soft">
          پاک‌کردن
        </a>
      </form>

      <div className="bg-surface rounded-2xl border border-line overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-xs text-stone-muted border-b border-line">
              <th className="p-4 text-right font-medium">زمان</th>
              <th className="p-4 text-right font-medium">رویداد</th>
              <th className="p-4 text-right font-medium">موضوع</th>
              <th className="p-4 text-right font-medium">عامل</th>
              <th className="p-4 text-right font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-cream/50 align-top">
                <td className="p-4 whitespace-nowrap text-stone-muted">{formatDate(r.createdAt)}</td>
                <td className="p-4">
                  <span className="rounded-lg bg-sand-soft px-2 py-0.5 text-[11px] font-semibold text-terracotta-deep">
                    {ACTION_LABELS[r.action] ?? r.action}
                  </span>
                </td>
                <td className="p-4">
                  <p className="text-xs text-stone-muted" dir="ltr">
                    {r.entityType} · {r.entityId.slice(0, 14)}…
                  </p>
                </td>
                <td className="p-4">{r.actorName ?? "سیستم"}</td>
                <td className="p-4 text-xs text-stone-muted" dir="ltr">
                  {r.ip ?? "—"}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-stone-muted">
                  رویدادی با این فیلتر یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/audit?page=${p}${sp.action ? `&action=${encodeURIComponent(sp.action)}` : ""}`}
              className={`size-9 flex items-center justify-center rounded-xl text-sm ${
                p === page ? "bg-deep text-cream font-bold" : "border border-line hover:bg-sand-soft"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
