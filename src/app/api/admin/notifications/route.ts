/**
 * GET /api/admin/notifications — فید اعلان‌های پنل (M2)
 * ---------------------------------------------------------------
 * اعلان‌ها «محاسبه زنده از دیتابیس» هستند — بدون جدول اضافه:
 *  - موجودی کم (کالا با آزادِ ≤ آستانه)
 *  - نظرات در انتظار تأیید
 *  - تلاش‌های ورود ناموفق اخیر (امنیت)
 *  - محتوای پیش‌نویس منتشرنشده
 * دسترسی: یکی از analytics.read / products.read / reviews.read
 */

import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/core/auth/guard";
import { dbSessionReader } from "@/core/auth/db-session-reader";
import { PERMISSIONS } from "@/core/auth/permissions";
import { toErrorBody, toInternalError, newRequestId } from "@/core/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 5;
const FAILED_LOGIN_THRESHOLD = 3;

export async function GET() {
  try {
    await requireAnyPermission(
      [PERMISSIONS.analyticsRead, PERMISSIONS.productsRead, PERMISSIONS.reviewsRead],
      { sessionReader: dbSessionReader },
    );

    type Notification = {
      id: string;
      type: "lowStock" | "pendingReview" | "failedLogin" | "draftContent";
      title: string;
      description: string;
      href: string;
      at: string;
      severity: "warning" | "info" | "critical";
    };
    const items: Notification[] = [];

    // ── موجودی کم — واریانت‌های فعال
    const variants = await db.variant.findMany({
      where: { isActive: true, deletedAt: null, product: { deletedAt: null } },
      include: { product: { select: { name: true, slug: true } }, color: true, size: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      take: 400,
    });
    const low = variants
      .map((v) => ({ v, free: Math.max(0, v.stock - v.reserved) }))
      .filter(({ free }) => free <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.free - b.free)
      .slice(0, 8);
    for (const { v, free } of low) {
      items.push({
        id: `low-stock-${v.id}`,
        type: "lowStock",
        title: free === 0 ? `موجودی تمام شد: ${v.product.name}` : `موجودی کم: ${v.product.name}`,
        description: `${v.color?.name ?? "—"} / ${v.size?.name ?? "—"} — ${free} عدد باقی مانده`,
        href: `/admin/products/${v.productId}/edit`,
        at: v.updatedAt.toISOString(),
        severity: free === 0 ? "critical" : "warning",
      });
    }

    // ── نظرات در انتظار
    const pendingCount = await db.review.count({ where: { status: "PENDING" } });
    if (pendingCount > 0) {
      items.push({
        id: "pending-reviews",
        type: "pendingReview",
        title: `${pendingCount} نظر در انتظار تأیید`,
        description: "نظرات جدید مشتریان منتظر بررسی شما هستند.",
        href: "/admin/reviews",
        at: new Date().toISOString(),
        severity: "info",
      });
    }

    // ── تلاش‌های ورود ناموفق ۲۴ ساعت اخیر
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const failedLogins = await db.auditLog.count({
      where: { action: "auth.login.failed", createdAt: { gte: since } },
    });
    if (failedLogins >= FAILED_LOGIN_THRESHOLD) {
      items.push({
        id: "failed-logins",
        type: "failedLogin",
        title: `${failedLogins} تلاش ورود ناموفق در ۲۴ ساعت اخیر`,
        description: "اگر این تلاش‌ها مال شما نبود، رمز را عوض کنید.",
        href: "/admin/audit?action=auth.login.failed",
        at: new Date().toISOString(),
        severity: "warning",
      });
    }

    // ── محتوای پیش‌نویس
    const drafts = await db.journalPost.count({ where: { status: "DRAFT" } });
    if (drafts > 0) {
      items.push({
        id: "draft-journal",
        type: "draftContent",
        title: `${drafts} مقاله پیش‌نویس`,
        description: "مقاله‌های نوشته‌شده که هنوز منتشر نشده‌اند.",
        href: "/admin/journal",
        at: new Date().toISOString(),
        severity: "info",
      });
    }

    // مرتب‌سازی: بحرانی → هشدار → اطلاع
    const order = { critical: 0, warning: 1, info: 2 } as const;
    items.sort((a, b) => order[a.severity] - order[b.severity]);

    return NextResponse.json(
      { data: items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const requestId = newRequestId();
    const err = toInternalError(e, requestId);
    return NextResponse.json(toErrorBody(err), { status: err.status });
  }
}
