#!/usr/bin/env bash
# ---------------------------------------------------------------
# ساخت مخزن «خصوصی» گیت‌هاب و پوش کردن شاخهٔ main
# استفاده:  bash scripts/github-init.sh <GITHUB_TOKEN> [نام-مخزن]
#   توکن از https://github.com/settings/tokens (دسترسی repo)
# نام پیش‌فرض مخزن: prima-towel-store
# ---------------------------------------------------------------
set -euo pipefail
TOKEN="${1:?Usage: bash scripts/github-init.sh <GITHUB_TOKEN> [repo-name]}"
REPO="${2:-prima-towel-store}"
API="https://api.github.com"
AUTH="Authorization: Bearer ${TOKEN}"

# ۱) شناسایی کاربر از روی توکن
LOGIN=$(curl -sf -H "$AUTH" "$API/user" | grep -m1 '"login"' | sed -E 's/.*"login": *"([^"]+)".*/\1/') \
  || { echo "❌ توکن نامعتبر است یا دسترسی شبکه نیست"; exit 1; }
echo "👤 حساب گیت‌هاب: $LOGIN"

# ۲) ساخت مخزن خصوصی (اگر از قبل باشد 422 می‌دهد — مشکلی نیست)
HTTP=$(curl -s -o /tmp/gh-repo-resp.json -w "%{http_code}" -X POST \
  -H "$AUTH" -H "Accept: application/vnd.github+json" \
  "$API/user/repos" \
  -d "{\"name\":\"$REPO\",\"private\":true,\"has_wiki\":false,\"has_projects\":false,\
\"description\":\"Persian premium towel e-commerce — Next.js 16, Prisma/PostgreSQL, RTL\"}")
if [ "$HTTP" = "201" ]; then
  echo "📦 مخزن خصوصی ساخته شد: $LOGIN/$REPO"
elif [ "$HTTP" = "422" ]; then
  echo "ℹ️  مخزن از قبل وجود دارد — از همان استفاده می‌کنیم"
else
  echo "❌ خطای ساخت مخزن (HTTP $HTTP):"; head -c 400 /tmp/gh-repo-resp.json; echo; exit 1
fi

# ۳) ریموت + پوش (توکن فقط در همین لحظه استفاده می‌شود و بعد پاک می‌شود)
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:${TOKEN}@github.com/${LOGIN}/${REPO}.git"
git push -u origin main
# توکن را از config پاک می‌کنیم تا ذخیره نماند
git remote set-url origin "https://github.com/${LOGIN}/${REPO}.git"
echo "🔗 آدرس مخزن: https://github.com/${LOGIN}/${REPO}"
echo "✅ پوش کامل شد — پشتیبان پروژه روی گیت‌هاب است."
