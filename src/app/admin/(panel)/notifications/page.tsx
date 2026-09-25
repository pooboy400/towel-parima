import Link from "next/link";
import { PackageX, MessageSquareQuote, ShieldAlert, FileEdit, Activity } from "lucide-react";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { formatRelativeFa } from "@/lib/admin/format-utils";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 5;

/**
 * مرکز اعلان‌ها — نسخه تمام‌صفحه فید زنگ اعلان (M2)
 * همان منبع API اعلان‌ها: محاسبه زنده از دیتابیس.
 */

type Severity = "warning" | "info" | "critical";

export default async function AdminNotificationsPage() {
  // CR-8/55-c — گارد یکدست با نقشهٔ read: عدم دسترسی = redirect به no-access
  // (requireAnyPermission قبلی throw می‌کرد و صفحهٔ خطای 500-مانند می‌داد)
  await requirePageAccess("notifications");

  const variants = await db.variant.findMany({
    where: { isActive: true, deletedAt: null, product: { deletedAt: null } },
    include: { product: { select: { id: true, name: true } }, color: true, size: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: 400,
  });
  const low = variants
    .map((v) => ({ v, free: Math.max(0, v.stock - v.reserved) }))
    .filter(({ free }) => free <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.free - b.free);

  const [pendingCount, failedLogins, drafts] = await Promise.all([
    db.review.count({ where: { status: "PENDING" } }),
    db.auditLog.count({
      where: { action: "auth.login.failed", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
    }),
    db.journalPost.count({ where: { status: "DRAFT" } }),
  ]);

  const cards: { title: string; value: number; severity: Severity; href: string; icon: typeof Activity; note: string }[] = [
    {
      title: "موجودی کم یا تمام‌شده",
      value: low.length,
      severity: low.some(({ free }) => free === 0) ? "critical" : low.length ? "warning" : "info",
      href: "/admin/products",
      icon: PackageX,
      note: `آستانه: ${formatNumber(LOW_STOCK_THRESHOLD)} عدد`,
    },
    {
      title: "نظرات در انتظار تأیید",
      value: pendingCount,
      severity: pendingCount > 0 ? "warning" : "info",
      href: "/admin/reviews",
      icon: MessageSquareQuote,
      note: "پس از تأیید در صفحه محصول منتشر می‌شود",
    },
    {
      title: "ورود ناموفق (۲۴ ساعت)",
      value: failedLogins,
      severity: failedLogins >= 3 ? "warning" : "info",
      href: "/admin/audit?action=auth.login.failed",
      icon: ShieldAlert,
      note: "در دفتر رویدادها پیگیری کنید",
    },
    {
      title: "مقالات پیش‌نویس",
      value: drafts,
      severity: "info",
      href: "/admin/journal",
      icon: FileEdit,
      note: "آماده انتشار",
    },
  ];

  return (
    <div>
      <PageHeader title="اعلان‌ها" description="پایش زنده موجودی، نظرات و امنیت — به‌روزرسانی هر دقیقه" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.title}
              href={c.href}
              className="bg-surface rounded-2xl border border-line p-5 hover:border-sand transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`size-10 rounded-xl flex items-center justify-center ${
                    c.severity === "critical"
                      ? "bg-red-50 text-red-600"
                      : c.severity === "warning"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-sand-soft text-terracotta-deep"
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                <span className="text-2xl font-bold tabular-nums">{formatNumber(c.value)}</span>
              </div>
              <p className="text-sm font-semibold">{c.title}</p>
              <p className="text-xs text-stone-muted mt-1">{c.note}</p>
            </Link>
          );
        })}
      </div>

      {/* جزئیات موجودی کم */}
      <section className="bg-surface rounded-2xl border border-line p-6">
        <h2 className="font-bold mb-4">کالاهای نیازمند شمارش انبار</h2>
        {low.length === 0 ? (
          <p className="text-sm text-stone-muted py-8 text-center flex items-center justify-center gap-2">
            <Activity className="size-4" />
            همه موجودی‌ها سالم‌اند — اعلان فوری‌ای نیست
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-muted border-b border-line">
                <th className="p-2.5 text-right font-medium">محصول</th>
                <th className="p-2.5 text-right font-medium">ترکیب</th>
                <th className="p-2.5 text-right font-medium">آزاد</th>
                <th className="p-2.5 text-left font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {low.slice(0, 20).map(({ v, free }) => (
                <tr key={v.id} className="border-b border-line/60 last:border-0">
                  <td className="p-2.5 font-medium">{v.product.name}</td>
                  <td className="p-2.5 text-stone-muted">
                    {v.color?.name ?? "—"} / {v.size?.name ?? "—"}
                  </td>
                  <td className={`p-2.5 tabular-nums font-bold ${free === 0 ? "text-red-600" : "text-amber-600"}`}>
                    {formatNumber(free)}
                  </td>
                  <td className="p-2.5 text-left">
                    <Link
                      href={`/admin/products/${v.productId}/edit`}
                      className="text-xs font-semibold text-terracotta-deep hover:underline"
                    >
                      اصلاح موجودی
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
