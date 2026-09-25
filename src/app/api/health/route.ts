import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimiter, RATE_RULES, rateKey } from "@/core/rate-limit";
import { extractClientIp } from "@/lib/client-ip";

/**
 * GET /api/health — سلامت سرویس + اتصال DB (DoD بخش ۲۷ — M1)
 * سبک و بدون auth برای uptime-monitor؛ هیچ داده‌ی حساسی برنمی‌گرداند.
 * SEC-06 (F-6/51c): rate-limit per-IP (publicApi) + پاسخ خطا بدون جزئیات اتصال
 * (error.message می‌تواند توپولوژی/اعتبارنامهٔ DB را لو بدهد).
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // SEC-06 — هر hit یک کوئری DB دارد؛ ارزان‌ترین DoS بسته می‌شود
  const ip = extractClientIp(request.headers) ?? "unknown";
  const rl = await rateLimiter.hit(rateKey("health", ip), RATE_RULES.publicApi);
  if (!rl.ok) {
    // CR-7 — کلاینت/مانیتور باید بداند کِی برگردد
    return NextResponse.json(
      { status: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      },
    );
  }

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
  } catch {
    // بدون جزئیات خطا — مانیتورینگ فقط «down» را لازم دارد
    return NextResponse.json(
      {
        status: "error",
        db: { connected: false },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
