import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const row = await db.contactMessage.create({
    data: { kind: "CONTACT", email: "diag@example.com", name: "diag", subject: "diag", message: "diag test row" },
  });
  console.log("created", row.id);
  const all = await db.contactMessage.findMany();
  console.log("total rows:", all.length);
  await db.contactMessage.delete({ where: { id: row.id } });
  console.log("cleaned");
  await db.$disconnect();
}
main();
