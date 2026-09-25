import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const row = await db.setting.findUnique({ where: { key: "store.shipping" } });
  console.log(JSON.stringify(row?.value, null, 1));
  await db.$disconnect();
}
main();
