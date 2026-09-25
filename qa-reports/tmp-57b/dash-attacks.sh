#!/usr/bin/env bash
# Task 57-b — بردار ۳: دورزدن گارد داشبورد + APIهای ادمین با نشست‌های mint‌شده
cd /home/z/my-project/towel-parima
OUT=qa-reports/tmp-57b/evidence-dash-guard.txt
SUP="prima_admin_session=57btoken_support_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
CNT="prima_admin_session=57btoken_content_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
MIN="prima_admin_session=57btoken_min_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
: > "$OUT"

echo "════ ۱) /admin با SUPPORT_AGENT — ۱۷ واریانت URL (--path-as-is) ════" | tee -a "$OUT"
i=0
while IFS= read -r v; do
  i=$((i+1))
  read -r code loc <<< "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --path-as-is -b "$SUP" "http://localhost:3000$v")"
  echo "V$i $v → $code ${loc:+→ $loc}" | tee -a "$OUT"
done <<'VARIANTS'
/admin
/admin/
/admin/?x=1
/admin/.
/admin/./
/ADMIN
/Admin
/admin%2F
/%61dmin
/admin;
/admin;a=b
//admin
/admin//
/./admin
/admin?next=/admin/staff
/%2e/admin
/admin/..
VARIANTS

echo "════ ۱-ب) دنبال‌کردن کامل زنجیرهٔ redirect برای واریانت‌های 3xx (-L) ════" | tee -a "$OUT"
for v in "/admin" "/admin/" "/ADMIN" "//admin" "/admin/.." "/%61dmin"; do
  final=$(curl -s -o /dev/null -w '%{url_effective} [%{http_code}]' -L --path-as-is -b "$SUP" "http://localhost:3000$v")
  echo "FOLLOW $v → $final" | tee -a "$OUT"
done

echo "════ ۲) APIهای ادمین با SUPPORT_AGENT (ordersRead/productsRead/reviewsRead/customersRead دارد؛ analyticsRead/mediaRead ندارد) ════" | tee -a "$OUT"
for ep in "/api/admin/dashboard/sales" "/api/admin/notifications" "/api/admin/media/list"; do
  g=$(curl -s -o /dev/null -w "%{http_code}" -b "$SUP" "http://localhost:3000$ep")
  body=$(curl -s -b "$SUP" "http://localhost:3000$ep" | head -c 160)
  p=$(curl -s -o /dev/null -w "%{http_code}" -X POST -b "$SUP" -H 'Content-Type: application/json' --data '{}' "http://localhost:3000$ep")
  echo "SUPPORT GET $ep → $g | POST → $p | body: $body" | tee -a "$OUT"
done

echo "════ ۳) همان ۳ API با QA57B_MIN (فقط content.read) ════" | tee -a "$OUT"
for ep in "/api/admin/dashboard/sales" "/api/admin/notifications" "/api/admin/media/list"; do
  g=$(curl -s -o /dev/null -w "%{http_code}" -b "$MIN" "http://localhost:3000$ep")
  body=$(curl -s -b "$MIN" "http://localhost:3000$ep" | head -c 120)
  echo "MIN GET $ep → $g | body: $body" | tee -a "$OUT"
done

echo "════ ۴) بدون نشست / کوکی جعلی ════" | tee -a "$OUT"
for ep in "/api/admin/dashboard/sales" "/api/admin/notifications" "/api/admin/media/list"; do
  n=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$ep")
  f=$(curl -s -o /dev/null -w "%{http_code}" -b "prima_admin_session=$(printf 'f%.0s' $(seq 1 64))" "http://localhost:3000$ep")
  fb=$(curl -s -b "prima_admin_session=$(printf 'f%.0s' $(seq 1 64))" "http://localhost:3000$ep" | head -c 100)
  echo "NO-COOKIE $ep → $n | FAKE-COOKIE → $f | body: $fb" | tee -a "$OUT"
done

echo "════ ۵) صفحات مجاز SUPPORT_AGENT — آیا KPI مالی تجمیعی دارند؟ ════" | tee -a "$OUT"
for p in "/admin/orders" "/admin/messages" "/admin/products" "/admin/reviews" "/admin/categories" "/admin/collections" "/admin/sms" "/admin/notifications"; do
  code=$(curl -s -o qa-reports/tmp-57b/page-support-last.html -w "%{http_code} %{redirect_url}" -b "$SUP" "http://localhost:3000$p")
  echo "PAGE $p → $code" | tee -a "$OUT"
done
# جستجوی KPIهای مالی تجمیعی در صفحات مجاز (حجم HTML + عبارات کلیدی)
for p in orders products collections messages; do
  curl -s -b "$SUP" "http://localhost:3000/admin/$p" -o "qa-reports/tmp-57b/page-$p.html"
  hits=$(grep -o "ارزش\|جمع کل\|مجموع فروش\|تومان" "qa-reports/tmp-57b/page-$p.html" | sort | uniq -c | tr '\n' ' ')
  echo "SCAN /admin/$p → $(wc -c < qa-reports/tmp-57b/page-$p.html) bytes | کلمات کلیدی: ${hits:-—}" | tee -a "$OUT"
done
grep -o "۱۲[^۰-۹]*سفارش\|سفارش[^<]*تومان" qa-reports/tmp-57b/page-orders.html | head -3 | tee -a "$OUT" || true
