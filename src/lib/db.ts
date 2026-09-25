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
 * Guard محیطی: اگر DATABASE_URL ورثه‌ی بقایای قدیمی (sqlite) باشد،
 * به رشته اتصال dev پیش‌فرض برمی‌گردیم تا بوت/پیش‌نمایش نشکند.
 * (همان رشته docker-compose.yml و .env.example — فقط dev؛ production
 * همیشه DATABASE_URL صحیح خودش را تزریق می‌کند.)
 */
if (!process.env.DATABASE_URL?.startsWith("postgresql")) {
  process.env.DATABASE_URL =
    "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";
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
