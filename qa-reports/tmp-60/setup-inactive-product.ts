/**
 * tmp-60-setup.ts — محصول تستی BUG-05: دو واریانتِ همه‌غیرفعال
 * برای تأیید زندهٔ «موجودی نمایشی ۰ + حالت ناموجود» توسط ایجنت کاربر
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const slug = "test-inactive-all-variants";

async function main() {
  const category = await db.category.findFirst();
  if (!category) throw new Error("no category");

  const existing = await db.product.findUnique({ where: { slug }, include: { variants: true } });
  if (existing) {
    console.log("قبلاً ساخته شده:", slug, "واریانت‌ها:", existing.variants.map((v) => v.isActive));
    await db.$disconnect();
    return;
  }

  const product = await db.product.create({
    data: {
      slug,
      name: "حولهٔ تست — همه واریانت‌ها غیرفعال",
      shortDescription: "محصول تست QA فاز ۲ (BUG-05) — نباید به مشتری نمایش فریبنده بدهد",
      description: "محصول تستی برای BUG-05 — دو واریانت غیرفعال؛ موجودی نمایشی باید صفر باشد.",
      status: "ACTIVE",
      categoryId: category.id,
      variants: {
        create: [
          { sku: "QA-INACT-1", price: 745_000, stock: 5, isActive: false },
          { sku: "QA-INACT-2", price: 745_000, stock: 3, isActive: false },
        ],
      },
    },
    include: { variants: true },
  });
  console.log("ساخته شد:", product.slug, "واریانت‌ها:", product.variants.map((v) => ({ sku: v.sku, active: v.isActive })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
