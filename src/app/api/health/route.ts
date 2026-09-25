import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/health — سلامت سرویس + اتصال DB (DoD بخش ۲۷ — M1)
 * سبک و بدون auth برای uptime-monitor؛ هیچ داده‌ی حساسی برنمی‌گرداند.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startedAt;

    const [products, categories, journal] = await Promise.all([
      db.product.count({ where: { deletedAt: null } }),
      db.category.count({ where: { deletedAt: null } }),
      db.journalPost.count({ where: { deletedAt: null } }),
    ]);

    return NextResponse.json({
      status: "ok",
      db: { connected: true, latencyMs: dbLatencyMs },
      counts: { products, categories, journal },
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: { connected: false },
        error: error instanceof Error ? error.message : "unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
