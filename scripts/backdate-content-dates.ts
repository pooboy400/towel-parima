/**
 * backdate-content-dates.ts — یک‌بار اجرا: تاریخ مقالات ژورنال و نظرات زنده را
 * تازه می‌کند (الگوی نسبی seed جدید). مثل backdate-product-createdAt.ts (Task 42).
 * اجرا: DATABASE_URL=... bun scripts/backdate-content-dates.ts
 */
import { PrismaClient } from "@prisma/client";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";

const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  // ژورنال: جدیدترین (بر اساس publishedAt فعلی) = ۲۰ روز پیش؛ بعدی‌ها هرکدام ۱۲ روز عقب‌تر
  const posts = await db.journalPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: { id: true },
  });
  for (const [i, post] of posts.entries()) {
    await db.journalPost.update({
      where: { id: post.id },
      data: { publishedAt: new Date(Date.now() - (20 + i * 12) * DAY) },
    });
  }
  console.log(`ژورنال: ${posts.length} مقاله تازه‌سازی شد`);

  // نظرات: پخش ۹ روز تا ~۱۰ ماه پیش (حفظ ترتیب قدیمی)
  const reviews = await db.review.findMany({
    orderBy: { publishedAt: "asc" },
    select: { id: true },
  });
  for (const [i, review] of reviews.entries()) {
    await db.review.update({
      where: { id: review.id },
      data: { publishedAt: new Date(Date.now() - (9 + (i % 20) * 15) * DAY) },
    });
  }
  console.log(`نظرات: ${reviews.length} نظر تازه‌سازی شد`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
