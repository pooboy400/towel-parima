import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const rows = await db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  console.log(JSON.stringify(rows, null, 1));
  await db.$disconnect();
}
main();
