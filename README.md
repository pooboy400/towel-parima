# حولهٔ پریمیوم — فروشگاه اینترنتی حمبافی لاکچری 🛁

فروشگاه اینترنتی کامل با زبان فارسی و چیدمان راست‌به‌چپ (RTL).

## تکنولوژی‌ها

| بخش | فناوری |
|------|--------|
| فریم‌ورک | Next.js 16 (Turbopack) + React 19 + TypeScript |
| استایل | Tailwind CSS 4 + shadcn/ui |
| دیتابیس | PostgreSQL (Embedded/pg.portable در dev) + Prisma ORM |
| احراز هویت | JWT + RBAC (قوانین نقش‌محور) |
| پرداخت | زرین‌پال (sandbox) + درگاه mock داخلی به‌عنوان جایگزین خودکار |
| پیامک | ۵ قالب فارسی + SmsLog + Outbox Worker |

## راه‌اندازی محلی

```bash
bun install
bash scripts/pg.sh start          # دیتابیس محلی
export DATABASE_URL="$(bash scripts/pg.sh url)"
bun prisma/migrations/deploy      # یا: bunx prisma migrate deploy
bun scripts/seed.ts               # دادهٔ اولیه
bun run dev                       # http://localhost:3000
```

پنل مدیریت: `/admin` — ورود با حساب ادمین (`bun scripts/create-admin.ts --show`)

## 📌 راهنمای چت جدید (برای دستیار هوشمند)

اگر این پروژه در گفتگوی جدید ادامه داده می‌شود، **قبل از هر کاری** این دو فایل را بخوان:

1. **`worklog.md`** — دفترچهٔ کار مشترک: ۴۴+ وظیفهٔ انجام‌شده با جزئیات فنی، تصمیم‌ها و درس‌ها (Task ID ترتیبی است)
2. **`docs/ARCHITECTURE.md`** — نقشهٔ کامل معماری v2.4 + ۱۱ تصمیم معماری (ADR)

سایر مستندات: `docs/DEMO-GUIDE-M5.md` (راهنمای نمایش امکانات).

### قراردادهای مهم پروژه

- هر کار انجام‌شده باید به `worklog.md` اضافه شود (قالب Task ID در انتهای فایل موجود است)
- تصمیم‌های معماری در `docs/ARCHITECTURE.md` به‌صورت ADR ثبت می‌شوند
- گزارش به کاربر همیشه به **فارسی ساده** با تشبیه زندگی روزمره
- برچسب‌های محصول «جدید/پرفروش/محدود» کاملاً خودکارند (ADR 011) — هرگز دستی زده نمی‌شوند
- دستور ری‌استارت سرور dev و نکات Next 16 (مانند محدودیت revalidateTag) داخل worklog هست

## ساختار پوشه‌ها

```
src/
  app/          → صفحات فروشگاه، پنل ادمین، API
  core/         → سرویس‌های دامنه (commerce, auth, cache, errors)
  domain/       → مدل‌ها و اسکیماهای Zod
  lib/          → repositoryها، config، ابزارها
  providers/    → درگاه پرداخت، پیامک
scripts/        → ابزارهای عملیاتی (seed، تست E2E، مدیریت ادمین)
prisma/         → schema + migrations + seed-data
tests/          → تست‌های unit و integration
docs/           → معماری و مستندات
skills/         → بسته‌های ابزار محیط کاری (غیرمرتبط با کد فروشگاه)
```
