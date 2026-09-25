/** بررسی موجودی واریانت‌ها برای تست E2E */
import { db } from "../src/lib/db";

const variants = await db.variant.findMany({
  where: {
    deletedAt: null,
    isActive: true,
    product: { is: { deletedAt: null, status: "ACTIVE" } },
  },
  select: {
    id: true,
    sku: true,
    stock: true,
    reserved: true,
    colorId: true,
    sizeId: true,
    product: { select: { slug: true, name: true } },
  },
  take: 60,
});

for (const v of variants.slice(0, 8)) {
  console.log(
    `${v.product.slug} | ${v.sku} | stock=${v.stock} reserved=${v.reserved} available=${v.stock - v.reserved} | color=${v.colorId} size=${v.sizeId}`,
  );
}
process.exit(0);
