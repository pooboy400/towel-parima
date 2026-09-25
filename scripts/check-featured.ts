import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const row = await db.setting.findUnique({ where: { key: "home.featured" } });
  console.log(JSON.stringify(row?.value));
  await db.$disconnect();
}
main();
