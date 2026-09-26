/**
 * tmp-60c/backfill-journal.ts — SEO-02/03 (فاز ۵)
 * به‌روزرسانی ۵ مقالهٔ موجود: بدنهٔ غنی (h2/h3/IMG) + ctaTitle
 * (seed.ts کامل journal را deleteMany می‌کند — این اسکریپت فقط journal را بازسازی می‌کند)
 * اجرا: DATABASE_URL=... bun qa-reports/tmp-60c/backfill-journal.ts
 */
import { PrismaClient } from "@prisma/client";
import { journalPosts } from "../../prisma/seed-data/content";

const db = new PrismaClient();

async function main() {
  for (const j of journalPosts) {
    const existing = await db.journalPost.findUnique({ where: { slug: j.slug } });
    if (!existing) {
      console.log("skip (نیست):", j.slug);
      continue;
    }
    await db.journalPost.update({
      where: { slug: j.slug },
      data: {
        bodyMarkdown: j.content.join("\n\n"),
        ctaTitle: j.ctaTitle ?? null,
      },
    });
    console.log("به‌روز شد:", j.slug, "→ ctaTitle:", j.ctaTitle);
  }
  const count = await db.journalPost.count();
  console.log("جمع مقالات:", count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
