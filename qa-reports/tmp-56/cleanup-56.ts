/** cleanup-56 — پاکسازی نشست/کاربر/نقش تستی mint-56 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const TAG = process.argv[2] ?? "";
if (!TAG.startsWith("qa56-")) throw new Error("tag نامعتبر");

const users = await db.user.findMany({ where: { email: { startsWith: `qa56-` } }, select: { id: true, email: true } });
const mine = users.filter((u) => u.email.endsWith(`@${TAG}.test`));
for (const u of mine) {
  await db.session.deleteMany({ where: { userId: u.id } });
  await db.user.delete({ where: { id: u.id } });
}
await db.role.deleteMany({ where: { id: { contains: TAG } } });
console.log(`deleted users=${mine.length} role=1(if-created)`);
await db.$disconnect();
