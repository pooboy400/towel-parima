import { PrismaClient } from "@prisma/client";
import { z } from "zod";
const shippingInfoSchema = z.object({
  preparationDays: z.string().min(1),
  standardDays: z.string().min(1),
  expressDays: z.string().min(1),
  returnWindowDays: z.number().int().nonnegative(),
  exchangeWindowDays: z.number().int().nonnegative(),
});
const db = new PrismaClient();
async function main() {
  const row = await db.setting.findUnique({ where: { key: "store.shipping" } });
  const parsed = shippingInfoSchema.safeParse(row?.value);
  console.log("parse ok:", parsed.success);
  if (!parsed.success) console.log(parsed.error.message);
  await db.$disconnect();
}
main();
