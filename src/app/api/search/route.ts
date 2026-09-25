import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/services/product-service";

/**
 * GET /api/search?q=
 * نمونه‌ی الگوی API فاز 2 — همین مسیر بعداً به دیتابیس وصل می‌شود.
 * پاسخ سبک و مخصوص Quick Search هدر.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

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
