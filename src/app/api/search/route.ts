import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/services/product-service";
import { rateLimiter, RATE_RULES, rateKey } from "@/core/rate-limit";
import { extractClientIp } from "@/lib/client-ip";

/**
 * GET /api/search?q=
 * نمونه‌ی الگوی API فاز 2 — همین مسیر بعداً به دیتابیس وصل می‌شود.
 * پاسخ سبک و مخصوص Quick Search هدر.
 *
 * rate-limit: search (30/1min per IP) — کوئری FTS زندهٔ Postgres طبق §16.2
 * کش نمی‌شود، پس محافظتش همین سقف است (HIGH-2 گزارش 47-a). سقف طول q هم
 * جلوی payload سنگین را می‌گیرد.
 */
const MAX_Q_LENGTH = 60;

export async function GET(request: NextRequest) {
  // rate-limit قبل از هر کوئری — IP فقط از پروکسی معتمد (SEC-02)
  const ip = extractClientIp(request.headers) ?? "unknown";
  const rl = await rateLimiter.hit(rateKey("search", ip), RATE_RULES.search);
  if (!rl.ok) {
    // CR-7 — کلاینت باید بداند کِی برگردد
    return NextResponse.json(
      { items: [] },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      },
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, MAX_Q_LENGTH) ?? "";

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const { items } = await getProducts({ query: q });

  return NextResponse.json({
    items: items.slice(0, 6).map((p) => ({
      name: p.name,
      slug: p.slug,
      image: p.images[0],
      price: p.price,
      category: p.categorySlug,
    })),
  });
}
