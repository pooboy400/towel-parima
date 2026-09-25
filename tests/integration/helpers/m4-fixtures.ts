/**
 * Helper M4 — ساخت واریانت تست با موجودی مشخص
 * (برای اشتراک بین describeها در فایل customer-m4)
 */

import type { PrismaClient } from "@prisma/client";

export async function makeVariantWithStock(
  db: PrismaClient,
  created: { variantIds: string[]; productIds: string[] },
  stock: number,
  inactive = false,
) {
  const product = await db.product.create({
    data: {
      slug: `m4test-${Date.now()}-${created.variantIds.length}-${Math.floor(Math.random() * 1000)}`,
      name: "محصول تست M4",
      shortDescription: "تست",
      description: "تست",
      status: "ACTIVE",
      categoryId: (await db.category.findFirst())!.id,
      variants: {
        create: {
          sku: `M4-${Date.now()}-${created.variantIds.length}`,
          price: 100_000,
          stock,
          isActive: !inactive,
        },
      },
    },
    include: { variants: true },
  });
  created.productIds.push(product.id);
  created.variantIds.push(product.variants[0].id);
  return product.variants[0];
}
