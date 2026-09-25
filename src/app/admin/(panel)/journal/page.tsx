import Link from "next/link";
import { db } from "@/lib/db";
import { formatNumber, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { JournalStatusBadge } from "./journal-badges";

export const dynamic = "force-dynamic";

export default async function AdminJournalPage() {
  const posts = await db.journalPost.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, status: true, createdAt: true, publishedAt: true },
  });

  const counts = {
    all: posts.length,
    published: posts.filter((p) => p.status === "PUBLISHED").length,
    draft: posts.filter((p) => p.status === "DRAFT").length,
  };

  return (
    <div>
      <PageHeader
        title="مقالات مجله"
        description={`${formatNumber(counts.published)} منتشرشده · ${formatNumber(counts.draft)} پیش‌نویس`}
        action={{ href: "/admin/journal/new", label: "مقاله جدید" }}
      />

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-muted border-b border-line">
              <th className="p-4 text-right font-medium">عنوان</th>
              <th className="p-3 text-right font-medium">وضعیت</th>
              <th className="p-3 text-right font-medium">ایجاد</th>
              <th className="p-3 text-left font-medium">اقدام</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-cream/50">
                <td className="p-4">
                  <Link href={`/admin/journal/${p.id}`} className="font-semibold hover:text-terracotta-deep">
                    {p.title}
                  </Link>
                  <span className="block text-xs text-stone-muted" dir="ltr">
                    /journal/{p.slug}
                  </span>
                </td>
                <td className="p-3">
                  <JournalStatusBadge status={p.status} />
                </td>
                <td className="p-3 text-stone-muted whitespace-nowrap">
                  {formatDate(p.createdAt.toISOString())}
                </td>
                <td className="p-3 text-left">
                  <Link
                    href={`/admin/journal/${p.id}`}
                    className="text-xs font-semibold text-terracotta-deep hover:underline"
                  >
                    ویرایش
                  </Link>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-stone-muted">
                  هنوز مقاله‌ای نوشته نشده — اولین مقاله را بسازید.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
