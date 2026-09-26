/**
 * tmp-60c/sync-roles.ts — INFRA-08/2 (فاز ۶)
 * همگام‌سازی نقش‌های سیستمی با ROLE_DEFINITIONS (افزودن profile.self
 * به نقش‌های موجود DB — همان آپسِرت seed، بدون دست زدن به بقیهٔ داده)
 */
import { PrismaClient } from "@prisma/client";
import { ROLE_DEFINITIONS } from "../../src/core/auth/roles";

const db = new PrismaClient();

async function main() {
  for (const role of ROLE_DEFINITIONS) {
    const r = await db.role.upsert({
      where: { name: role.name },
      update: { title: role.title, permissions: [...role.permissions], isSystem: true },
      create: {
        name: role.name,
        title: role.title,
        permissions: [...role.permissions],
        isSystem: true,
      },
    });
    console.log(`${r.name}: ${r.permissions.length} مجوز`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
