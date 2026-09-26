process.env.NODE_ENV ??= "test";
const { mapJournalToDomain } = await import("/home/z/my-project/towel-parima/src/lib/repositories/mappers.ts");
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const row = await db.journalPost.findFirstOrThrow({ where: { slug: "how-to-wash-towels" } });
const mapped = mapJournalToDomain(row as never);
console.log("mapped ctaTitle:", JSON.stringify(mapped.ctaTitle));
console.log("h3 present:", mapped.content.some((c: string) => c.startsWith("### ")));
process.exit(0);
