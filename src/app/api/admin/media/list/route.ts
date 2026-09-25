/**
 * GET /api/admin/media/list — فهرست کتابخانه رسانه (media.read)
 * جدیدترین اول + صفحه‌بندی سبک برای دیالوگ انتخاب تصویر فرم‌ها.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/core/auth/guard";
import { dbSessionReader } from "@/core/auth/db-session-reader";
import { PERMISSIONS } from "@/core/auth/permissions";
import { toErrorBody, toInternalError, newRequestId } from "@/core/errors";
import { storageProvider } from "@/providers/local-storage";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.mediaRead, { sessionReader: dbSessionReader });

    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
    const perPage = 24;

    const [total, rows] = await Promise.all([
      db.mediaObject.count(),
      db.mediaObject.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          storageKey: true,
          mime: true,
          sizeBytes: true,
          width: true,
          height: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        data: {
          items: rows.map((r) => ({
            id: r.id,
            url: storageProvider.publicUrl(r.storageKey),
            thumbUrl: storageProvider.publicUrl(r.storageKey.replace(/\.webp$/, ".thumb.webp")),
            mime: r.mime,
            sizeBytes: r.sizeBytes,
            width: r.width,
            height: r.height,
            createdAt: r.createdAt.toISOString(),
          })),
          total,
          page,
          pages: Math.max(1, Math.ceil(total / perPage)),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const requestId = newRequestId();
    const err = toInternalError(e, requestId);
    return NextResponse.json(toErrorBody(err), { status: err.status });
  }
}
