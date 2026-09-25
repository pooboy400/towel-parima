/**
 * درج یک‌بارهٔ Setting «store.badgeRules» در دیتابیسِ فعلی (ADR 011).
 * ---------------------------------------------------------------
 * این تنظیم بعد از seed اولیه به پروژه اضافه شده بود، پس ردیفش در دیتابیس
 * موجود نبود و هر خواندن storefront به مسیر «پیدا نشد» می‌افتد.
 * این اسکریپت فقط همان یک ردیف را با مقادیر پیش‌فرض lib/config upsert
 * می‌کند — بدون seed کامل (تا محصولات/سفارش‌ها دست‌نخورده بمانند).
 *
 * اجرا:  bun scripts/add-badge-rules-setting.ts
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_BADGE_RULES } from "@/lib/config";

if (!process.env.DATABASE_URL?.startsWith("postgresql")) {
  console.error("خطا: DATABASE_URL باید postgresql باشد. scripts/pg.sh start را اجرا کنید.");
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  const before = await db.setting.findUnique({ where: { key: "store.badgeRules" } });
  if (before) {
    console.log("ردیف از قبل وجود دارد — دست‌نخورده ماند:", JSON.stringify(before.value));
    return;
  }
  await db.setting.create({
    data: { key: "store.badgeRules", value: DEFAULT_BADGE_RULES as object },
  });
  console.log("store.badgeRules با پیش‌فرض‌ها ساخته شد ✓", JSON.stringify(DEFAULT_BADGE_RULES));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
