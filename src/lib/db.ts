import { PrismaClient } from "@prisma/client";

/**
 * Prisma Singleton — تنها فایل مجاز به import از @prisma/client
 * در کنار Repositoryها (بخش ۳ سند معماری).
 * لاگ query فقط با DEBUG_PRISMA=1 — در production فقط warn/error.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * SEC-13 (فاز ۳) — رشتهٔ اتصال dev هاردکد از کد حذف شد (الگوی «secret در کد»).
 * نبود/نامعتبری DATABASE_URL → fail-fast با پیام واضح؛ دیگر بی‌صدا به یک
 * رشتهٔ شناخته‌شده برنمی‌گردیم. راه‌اندازی محیط dev:
 *   bash scripts/pg.sh start && export DATABASE_URL="$(bash scripts/pg.sh url)"
 * (اسکریپت‌های test/ci در package.json خودشان مقدار را تزریق می‌کنند.)
 */
if (!process.env.DATABASE_URL?.startsWith("postgresql")) {
  throw new Error(
    "DATABASE_URL تنظیم نشده یا معتبر نیست (باید با postgresql:// شروع شود).\n" +
      'راه‌اندازی: bash scripts/pg.sh start && export DATABASE_URL="$(bash scripts/pg.sh url)"',
  );
}

const logLevels =
  process.env.DEBUG_PRISMA === "1"
    ? (["query", "warn", "error"] as const)
    : process.env.NODE_ENV === "production"
      ? (["error"] as const)
      : (["warn", "error"] as const);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [...logLevels],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
