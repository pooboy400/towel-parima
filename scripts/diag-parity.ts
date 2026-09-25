/**
 * diag-parity — تطبیق داده DB با داده mock فاز ۱ (DoD M1: «داده = داده فعلی mock»)
 * مقایسه: قیمت، موجودی، تعداد رنگ/سایز، تصاویر، کالکشن‌ها، امتیاز برای همه محصولات
 */
import { PrismaClient } from "@prisma/client";
import { products as mockProducts } from "../prisma/seed-data/products";
import { mapProductToDomain } from "../src/lib/repositories/mappers";

const db = new PrismaClient({ log: ["error"] });

const rows = await db.product.findMany({
  include: {
    variants: { where: { isActive: true, deletedAt: null }, include: { color: true, size: true } },
    images: true,
    collections: { include: { collection: true } },
    category: true,
  },
});

let mismatches = 0;
const mockBySlug = new Map(mockProducts.map((m) => [m.slug, m]));

for (const row of rows) {
  const d = mapProductToDomain(row as never);
  const m = mockBySlug.get(d.slug);
  if (!m) {
    console.log(`✗ ${d.slug}: در mock نیست`);
    mismatches++;
    continue;
  }
  const checks: [string, unknown, unknown][] = [
    ["price", d.price, m.price],
    ["compareAtPrice", d.compareAtPrice ?? null, m.compareAtPrice ?? null],
    ["sku", d.sku, m.sku],
    ["stock", d.stock, m.stock],
    ["colors", d.colors.map((c) => c.id).join(","), m.colors.map((c) => c.id).join(",")],
    ["sizes", d.sizes.map((s) => s.id).join(","), m.sizes.map((s) => s.id).join(",")],
    ["images", d.images.join(","), m.images.join(",")],
    ["collections", d.collectionSlugs.join(","), m.collectionSlugs.join(",")],
    ["category", d.categorySlug, m.categorySlug],
    ["rating", d.rating, m.rating],
    ["reviewCount", d.reviewCount, m.reviewCount],
    ["badges", d.badges.join(","), m.badges.join(",")],
    ["specs", d.specs.length, m.specs.length],
    ["care", d.care.length, m.care.length],
    ["suitableFor", d.suitableFor.length, m.suitableFor.length],
    ["features", d.features.length, m.features.length],
    ["order", d.order, m.order],
  ];
  for (const [name, got, want] of checks) {
    if (String(got) !== String(want)) {
      console.log(`✗ ${d.slug}.${name}: DB=${got} mock=${want}`);
      mismatches++;
    }
  }
}

const extra = [...mockBySlug.keys()].filter((s) => !rows.some((r) => r.slug === s));
for (const s of extra) {
  console.log(`✗ ${s}: در mock هست ولی در DB نیست`);
  mismatches++;
}

console.log(
  mismatches === 0
    ? `پاریتی کامل ✓ — ${rows.length} محصول، همه فیلدها برابر mock`
    : `تعداد ناهماهنگی: ${mismatches}`,
);
await db.$disconnect();
process.exit(mismatches === 0 ? 0 : 1);
