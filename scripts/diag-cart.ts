/** بررسی سبد سروری کاربر 09357770022 */
import { db } from "../src/lib/db";

const user = await db.user.findUnique({
  where: { phone: "09357770022" },
  select: {
    id: true,
    name: true,
    lastLoginAt: true,
    cart: { include: { items: true } },
  },
});
console.log(JSON.stringify(user, null, 2));
process.exit(0);
