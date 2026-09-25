// بررسی createdAt و موجودی کل محصولات — برای قوانین برچسب خودکار
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      slug: true,
      createdAt: true,
      variants: { select: { stock: true, reserved: true, isActive: true, deletedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  console.log("امروز:", new Date().toISOString());
  for (const p of products) {
    const active = p.variants.filter((v) => v.isActive && !v.deletedAt);
    const available = active.reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0);
    const days = Math.floor((Date.now() - p.createdAt.getTime()) / 86400000);
    console.log(`${p.slug}: createdAt=${p.createdAt.toISOString().slice(0, 10)} (${days} روز پیش) · موجودی=${available}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
