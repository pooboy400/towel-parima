// بررسی برچسب‌های محصول prima-bath-towel — آیا از دیتابیس می‌آیند؟
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findUnique({
    where: { slug: "prima-bath-towel" },
    select: {
      slug: true,
      name: true,
      badges: true,
      status: true,
      variants: { select: { price: true, compareAtPrice: true, stock: true } },
    },
  });
  console.log(JSON.stringify(p, null, 2));

  // همه محصولات با برچسب — برای مقایسه
  const all = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { slug: true, badges: true },
    orderBy: { sortOrder: "asc" },
  });
  console.log("\n--- همه محصولات و برچسب‌هایشان ---");
  for (const x of all) {
    console.log(`${x.slug}: [${x.badges.join(", ")}]`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
