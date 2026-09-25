/**
 * GET /api/admin/dashboard/sales — داده نمودار فروش ۱۴ روز اخیر
 * با راه‌اندازی فروش (M3) زنده می‌شود؛ الان مجموعه خالی برمی‌گرداند.
 */

import { NextResponse } from "next/server";
import { requirePermission } from "@/core/auth/guard";
import { dbSessionReader } from "@/core/auth/db-session-reader";
import { PERMISSIONS } from "@/core/auth/permissions";
import { toErrorBody, toInternalError, newRequestId } from "@/core/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.analyticsRead, { sessionReader: dbSessionReader });

    const since = new Date(Date.now() - 14 * 24 * 60 * 60_000);
    const rows = await db.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, grandTotal: true },
    });

    // buckets روزانه — خروجی همیشه ۱۴ نقطه دارد
    const fmtDay = new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" });
    const points: { date: string; label: string; total: number; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 24 * 60 * 60_000);
      const key = day.toISOString().slice(0, 10);
      const hit = rows.filter((r) => r.createdAt.toISOString().slice(0, 10) === key);
      points.push({
        date: key,
        label: fmtDay.format(day),
        total: hit.reduce((s, r) => s + r.grandTotal, 0),
        count: hit.length,
      });
    }

    return NextResponse.json({ data: points }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const requestId = newRequestId();
    const err = toInternalError(e, requestId);
    return NextResponse.json(toErrorBody(err), { status: err.status });
  }
}
