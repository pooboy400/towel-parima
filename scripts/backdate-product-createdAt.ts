// به‌روزرسانی createdAt محصولات زنده — پخش واقع‌گرایانه (ADR 011: قانون «جدید» دموی صادقانه بدهد)
// دو محصول اخیر (۶ و ۲ روز) بقیه پراکنده بین ۲۰ تا ۱۲۰ روز
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLAN: Record<string, number> = {
  "prima-bath-towel": 95,
  "prima-bath-towel-taupe": 90,
  "prima-hand-face-towel": 120,
  "prima-guest-towel-striped": 6,
  "prima-pool-towel": 60,
  "prima-white-hotel-towel": 75,
  "prima-towel-set-4pcs": 30,
  "prima-warm-stack-set": 50,
  "prima-kids-towel": 20,
  "prima-waffle-bathrobe": 40,
  "prima-spa-towel-set": 45,
  "prima-travel-towel": 2,
};

async function main() {
  for (const [slug, daysAgo] of Object.entries(PLAN)) {
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const res = await prisma.product.updateMany({
      where: { slug },
      data: { createdAt },
    });
    console.log(`${slug}: ${daysAgo} روز پیش (${res.count} ردیف)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
