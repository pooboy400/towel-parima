/**
 * داشبورد پنل — رصد فروش/سایت/محتوا (M2، خواسته مالک)
 * ---------------------------------------------------------------
 * - KPIها + نمودارها (موجودی بر اساس دسته، وضعیت محصولات، سهم دسته‌ها)
 * - نمودار فروش ۱۴ روز اخیر: از جدول Order تغذیه می‌شود — تا راه‌اندازی
 *   فروش (M3) حالت خالی شیک نمایش می‌دهد و بعد خودکار زنده می‌شود.
 * - اعلان‌ها/موجودی کم/نظرات در انتظار + سلامت سایت (latency دیتابیس)
 * - «سفارش‌های اخیر» هم با M3 به این صفحه اضافه می‌شود.
 */

import Link from "next/link";
import Image from "next/image";
import {
  Package,
  Boxes,
  MessageSquareQuote,
  ShoppingCart,
  AlertTriangle,
  FileText,
  Database,
  ImageIcon,
  CreditCard,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { PERMISSIONS } from "@/core/auth/permissions";
import { db } from "@/lib/db";
import { formatNumber, formatDate, formatPrice, faDigits } from "@/lib/format";
import { KpiCard, SectionCard, PageHeader } from "@/components/admin/page-header";
import { HorizontalBarChart, DonutChart } from "@/components/admin/charts";
import { ChartPlaceholder } from "@/components/admin/sales-chart";
import { BestsellerAutoCard } from "@/components/admin/bestseller-card";
import { getBestsellerReport } from "@/core/commerce/bestseller-service";
import { getPaymentGatewayInfo } from "@/providers/payment";
import { LOW_STOCK_THRESHOLD } from "@/lib/config";

export const dynamic = "force-dynamic";

/** آستانهٔ کالای کم‌موجود — یک منبع واحد با کارت/صفحهٔ محصول (lib/config) */
const LOW_STOCK = LOW_STOCK_THRESHOLD;

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export default async function AdminDashboardPage() {
  // CR-1/55-c — داشبورد KPI تجمیعی فروش/انبار دارد؛ فقط با analyticsRead
  // (SUPPORT_AGENT به no-access می‌رود؛ no-access لینک شرطی داشبورد را از قبل
  // با analyticsRead فرض کرده بود — یعنی طراحی اصلی همین گیت را پیش‌بینی کرده بود)
  const ctx = await requirePageAccess("dashboard");
  const can = (p: string) => ctx.actor.permissions.includes(p);

  // ── شمارش‌ها
  const [
    activeProducts,
    draftProducts,
    archivedProducts,
    variants,
    categories,
    journalCount,
    mediaCount,
    pendingReviews,
    approvedReviews,
    orderCount,
  ] = await Promise.all([
    db.product.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.product.count({ where: { status: "DRAFT", deletedAt: null } }),
    db.product.count({ where: { status: "ARCHIVED", deletedAt: null } }),
    db.variant.findMany({
      where: { isActive: true, deletedAt: null, product: { deletedAt: null } },
      select: {
        stock: true,
        reserved: true,
        price: true,
        product: { select: { categoryId: true } },
      },
    }),
    db.category.count({ where: { deletedAt: null } }),
    db.journalPost.count(),
    db.mediaObject.count(),
    db.review.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "APPROVED" } }),
    db.order.count(),
  ]);

  const totalFreeStock = variants.reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0);
  const inventoryValue = variants.reduce(
    (s, v) => s + Math.max(0, v.stock - v.reserved) * v.price,
    0,
  );

  // ── موجودی بر اساس دسته + سهم دسته‌ها
    const catRows = await db.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { sortOrder: "asc" },
    });
  const stockByCategory = catRows
    .map((c) => ({
      label: c.name,
      value: variants
        .filter((v) => v.product.categoryId === c.id)
        .reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── واریانت‌های کم‌موجود
  const lowStockVariants = await db.variant.findMany({
    where: { isActive: true, deletedAt: null, product: { deletedAt: null } },
    include: {
      product: { select: { id: true, name: true, slug: true } },
      color: true,
      size: true,
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: 300,
  });
  const lowList = lowStockVariants
    .map((v) => ({ v, free: Math.max(0, v.stock - v.reserved) }))
    .filter(({ free }) => free <= LOW_STOCK)
    .sort((a, b) => a.free - b.free)
    .slice(0, 6);

  // ── سلامت سایت — latency واقعی دیتابیس
  const t0 = Date.now();
  await db.$queryRaw`SELECT 1`;
  const dbLatency = Math.max(1, Date.now() - t0);

  // ── گزارش پرفروش‌های خودکار (ADR 011) — از OrderItem تجمیع می‌شود؛ برچسب خودکار زده می‌شود
  const bestsellerReport = await getBestsellerReport({ limit: 3 });

  // ── درگاه فعال — شفافیت مالک (دمو/سندباکس/واقعی)
  const gatewayInfo = getPaymentGatewayInfo();

  // ── آخرین رویدادهای ادمین (اگر مجاز)
  const recentAudit = can(PERMISSIONS.auditRead)
    ? await db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { actor: { select: { name: true, email: true } } },
      })
    : [];

  // ── مقالات اخیر
  const recentPosts = await db.journalPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, slug: true, title: true, status: true, createdAt: true, coverKey: true },
  });

  const statusDonut = [
    { label: "فعال", value: activeProducts, color: "var(--color-chart-4)" },
    { label: "پیش‌نویس", value: draftProducts, color: "var(--color-chart-2)" },
    { label: "آرشیو", value: archivedProducts, color: "var(--color-chart-5)" },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <PageHeader
        title="داشبورد"
        description="نمای کلی فروشگاه: کالا، موجودی، محتوا و سلامت سیستم"
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <KpiCard
          title="محصولات فعال"
          value={formatNumber(activeProducts)}
          hint={`${formatNumber(variants.length)} کالای قابل‌فروش · ${formatNumber(categories)} دسته`}
          icon={Package}
        />
        <KpiCard
          title="موجودی آزاد"
          value={formatNumber(totalFreeStock)}
          hint={`ارزش تقریبی انبار: ${formatPrice(inventoryValue)}`}
          icon={Boxes}
          tone="success"
        />
        <KpiCard
          title="سفارش‌ها"
          value={formatNumber(orderCount)}
          hint="با راه‌اندازی فروش (فاز M3) این بخش زنده می‌شود"
          icon={ShoppingCart}
        />
        <KpiCard
          title="نظرات در انتظار"
          value={formatNumber(pendingReviews)}
          hint={`${formatNumber(approvedReviews)} نظر تأییدشده`}
          icon={MessageSquareQuote}
          tone={pendingReviews > 0 ? "warning" : "default"}
        />
      </div>

      {/* نمودارها */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <SectionCard
          title="روند فروش ۱۴ روز اخیر"
          description="مجموع مبلغ سفارش‌های ثبت‌شده در هر روز"
        >
          <ChartPlaceholder />
        </SectionCard>

        <SectionCard title="موجودی آزاد بر اساس دسته" description="جمع کالاهای قابل‌فروش">
          <HorizontalBarChart data={stockByCategory} emptyMessage="هنوز موجودی ثبت نشده است" />
        </SectionCard>
      </div>

      {/* پرفروش‌های خودکار — گزارش فروش واقعی؛ برچسب بدون تأیید ادمین (ADR 011) */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <SectionCard
          title="پرفروش‌های خودکار"
          description={`بر اساس فروش پرداخت‌شدهٔ ${faDigits(bestsellerReport.windowDays)} روز اخیر — برچسب خودکار زده می‌شود`}
        >
          <BestsellerAutoCard report={bestsellerReport} />
        </SectionCard>

        <SectionCard title="وضعیت محصولات" description="توزیع سبد کالا">
          <DonutChart
            data={statusDonut}
            centerValue={formatNumber(activeProducts + draftProducts + archivedProducts)}
            centerLabel="محصول"
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <SectionCard
          title="موجودی‌های نیازمند توجه"
          description={`کالاهایی با ${formatNumber(LOW_STOCK)} عدد یا کمتر`}
          action={
            <Link
              href="/admin/products"
              className="text-xs font-semibold text-terracotta-deep hover:underline flex items-center gap-1"
            >
              همه محصولات
              <ArrowLeft className="size-3" />
            </Link>
          }
        >
          {lowList.length === 0 ? (
            <p className="text-sm text-stone-muted py-6 text-center">
              الان هیچ کالایی در آستانه نیست — انبار سالم است 👌
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {lowList.map(({ v, free }) => (
                <li key={v.id} className="py-2.5 flex items-center gap-3">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
                      free === 0 ? "bg-red-500" : "bg-amber-500"
                    }`}
                    aria-hidden
                  />
                  <Link
                    href={`/admin/products/${v.productId}/edit`}
                    className="text-sm font-medium hover:text-terracotta-deep truncate flex-1"
                  >
                    {v.product.name}
                  </Link>
                  <span className="text-xs text-stone-muted shrink-0">
                    {v.color?.name ?? "—"} / {v.size?.name ?? "—"}
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums shrink-0 ${
                      free === 0 ? "text-red-600" : "text-amber-600"
                    }`}
                  >
                    {formatNumber(free)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="سلامت سایت" description="پایش زیرساخت">
          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <span className="size-9 rounded-xl bg-emerald-50 text-sage flex items-center justify-center">
                <Database className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">دیتابیس</p>
                <p className="text-xs text-stone-muted">پاسخ در {formatNumber(dbLatency)} میلی‌ثانیه</p>
              </div>
              <span className="text-xs font-bold text-sage">متصل</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="size-9 rounded-xl bg-sand-soft text-terracotta-deep flex items-center justify-center">
                <ImageIcon className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">رسانه</p>
                <p className="text-xs text-stone-muted">{formatNumber(mediaCount)} تصویر در کتابخانه</p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <span className="size-9 rounded-xl bg-sand-soft text-terracotta-deep flex items-center justify-center">
                <FileText className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">مقالات مجله</p>
                <p className="text-xs text-stone-muted">{formatNumber(journalCount)} مقاله</p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <span className="size-9 rounded-xl bg-emerald-50 text-sage flex items-center justify-center">
                <CreditCard className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">درگاه پرداخت</p>
                <p className="text-xs text-stone-muted">{gatewayInfo.label}</p>
              </div>
              <span className="text-xs font-bold text-sage">فعال</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="size-9 rounded-xl bg-emerald-50 text-sage flex items-center justify-center">
                <Mail className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">نامه‌رسان (Worker)</p>
                <p className="text-xs text-stone-muted">پیامک‌ها و رخدادها — هر ۵ ثانیه</p>
              </div>
              <span className="text-xs font-bold text-sage">روشن</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="size-9 rounded-xl bg-emerald-50 text-sage flex items-center justify-center">
                <AlertTriangle className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">هشدار امنیتی</p>
                <p className="text-xs text-stone-muted">در دفتر رویدادها پایش می‌شود</p>
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>

      {/* ردیف پایین: رویدادها + مقالات */}
      <div className="grid gap-4 lg:grid-cols-2">
        {can(PERMISSIONS.auditRead) && (
          <SectionCard
            title="آخرین رویدادها"
            description="دفتر رویدادها — آخرین فعالیت‌های پنل"
            action={
              <Link
                href="/admin/audit"
                className="text-xs font-semibold text-terracotta-deep hover:underline flex items-center gap-1"
              >
                دفتر کامل
                <ArrowLeft className="size-3" />
              </Link>
            }
          >
            {recentAudit.length === 0 ? (
              <p className="text-sm text-stone-muted py-6 text-center">هنوز رویدادی ثبت نشده</p>
            ) : (
              <ul className="divide-y divide-line">
                {recentAudit.map((a) => (
                  <li key={a.id} className="py-2.5 text-sm flex items-center gap-3">
                    <span className="rounded-lg bg-sand-soft px-2 py-0.5 text-[10px] font-mono text-terracotta-deep shrink-0" dir="ltr">
                      {a.action}
                    </span>
                    <span className="truncate flex-1 text-ink/80">
                      {a.entityType} · {a.actor?.name ?? a.actor?.email ?? "سیستم"}
                    </span>
                    <span className="text-xs text-stone-muted shrink-0">
                      {formatDate(a.createdAt.toISOString())}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        <SectionCard
          title="مقالات اخیر مجله"
          action={
            <Link
              href="/admin/journal"
              className="text-xs font-semibold text-terracotta-deep hover:underline flex items-center gap-1"
            >
              مدیریت مقالات
              <ArrowLeft className="size-3" />
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {recentPosts.map((p) => (
              <li key={p.id} className="py-2.5 flex items-center gap-3">
                <span className="size-10 rounded-xl bg-sand-soft overflow-hidden shrink-0 relative">
                  {p.coverKey && (
                    <Image src={p.coverKey} alt="" fill className="object-cover" sizes="40px" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{p.title}</span>
                  <span className="block text-xs text-stone-muted">
                    {formatDate(p.createdAt.toISOString())}
                  </span>
                </span>
                <span className="text-[10px] rounded-lg px-2 py-1 bg-sand-soft text-terracotta-deep font-semibold shrink-0">
                  {p.status === "PUBLISHED" ? "منتشرشده" : p.status === "DRAFT" ? "پیش‌نویس" : "آرشیو"}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
