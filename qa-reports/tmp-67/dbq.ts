import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const sql = process.argv[2] ?? "";
try {
  const rows = await db.$queryRawUnsafe(sql);
  console.log(JSON.stringify(rows, (k, v) => (typeof v === "bigint" ? Number(v) : v), 1));
} catch (e) {
  console.error("ERR", (e as Error).message);
} finally {
  await db.$disconnect();
}
