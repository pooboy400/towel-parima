/** یک‌بار: درج Setting «home.featured» در دیتابیس زنده (بخش ۴.۲.۱/ADR) */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  await db.setting.upsert({
    where: { key: "home.featured" },
    update: {},
    create: { key: "home.featured", value: { featuredCollectionSlug: "spa", headline: "حس اسپا، در خانه خودتان" } },
  });
  console.log("home.featured OK");
}
main().finally(() => db.$disconnect());
