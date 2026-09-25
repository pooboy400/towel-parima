#!/usr/bin/env bash
# ---------------------------------------------------------------
# restore-from-github.sh — بازگرداندن کامل پروژه از گیت‌هاب به یک محیط کاملاً تازه
# (سرور دیگر، سندباکس دیگر — بدون هیچ اثری از محیط قبلی)
#
# روش استفاده در محیط تازه (دو دستور):
#   git clone "https://x-access-token:<TOKEN>@github.com/<USER>/<REPO>.git" project
#   cd project && bash scripts/restore-from-github.sh <TOKEN> <REPO_URL>
#
#  * مخزن خصوصی فقط با توکن باز می‌شود (کلید گاوصندوق) — توکن را امن نگه دارید
#  * بعد از کلون، توکن از origin پاک می‌شود تا در فایل‌ها ذخیره نماند
#  * نتیجه: کد + پکیج‌ها + دیتابیس + اسکیما + دادهٔ اولیه — همه آماده
# ---------------------------------------------------------------
set -euo pipefail
TOKEN="${1:?Usage: bash scripts/restore-from-github.sh <TOKEN> <REPO_URL>}"
REPO_URL="${2:?Usage: bash scripts/restore-from-github.sh <TOKEN> <REPO_URL>}"

# ۱) اگر داخل مخزن هستیم از همین ادامه بده؛ وگرنه کلون کن
if [ -d .git ]; then
  echo "ℹ️  داخل مخزن هستیم — از همین نسخه ادامه می‌دهیم"
else
  echo "📥 کلون مخزن از گیت‌هاب..."
  git clone "https://x-access-token:${TOKEN}@${REPO_URL#https://}" project
  cd project
  git remote set-url origin "$REPO_URL"   # توکن ذخیره نماند
fi

# ۲) پکیج‌های Node
echo "📦 نصب پکیج‌ها (bun install)..."
bun install

# ۳) دیتابیس پرتابل: باینری‌ها → init → start
[ -x .pg/bin/pg_ctl ] || bash scripts/setup-pg.sh
bash scripts/pg.sh init            # اگر از قبل init شده، رد می‌شود
bash scripts/pg.sh start
DBURL="$(bash scripts/pg.sh url)"
export DATABASE_URL="$DBURL"

# ۴) اسکیما + مهاجرت‌ها (migrate dev دیتابیس prima را اگر نبود خودش می‌سازد)
echo "🧱 ساخت/اعمال مهاجرت‌ها..."
bunx prisma generate
bunx prisma migrate dev

# ۵) دادهٔ اولیه — فقط اگر دیتابیس خالی است (تا seed تکراری، دادهٔ دوبله نسازد)
COUNT=$(bun -e "const m = await import('@prisma/client'); const db = new m.PrismaClient(); const c = await db.product.count(); console.log(c); await db.\$disconnect();")
if [ "${COUNT:-0}" -gt 0 ]; then
  echo "ℹ️  دیتابیس از قبل داده دارد (${COUNT} محصول) — seed رد شد"
else
  echo "🌱 درج دادهٔ اولیه..."
  bun scripts/seed.ts
fi

echo ""
echo "✅ بازگردانی کامل شد!"
echo "   • اجرای فروشگاه:      bun run dev  →  http://localhost:3000"
echo "   • ساخت حساب ادمین:    bun scripts/create-admin.ts --show"
echo "   • حافظهٔ پروژه:       اول worklog.md و docs/ARCHITECTURE.md را بخوانید"
