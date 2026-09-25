import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const del = await db.contactMessage.deleteMany({ where: { email: { in: ["audit-test@example.com", "newsletter-test@example.com", "diag@example.com"] } } });
  console.log("deleted:", del.count);
  await db.$disconnect();
}
main();
