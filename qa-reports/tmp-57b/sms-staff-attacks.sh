#!/usr/bin/env bash
# Task 57-b — بردار ۵/۶: مقصد redirect صفحات sms/notifications + واریانت‌های تازهٔ URL روی /admin/staff
cd /home/z/my-project/towel-parima
OUT=qa-reports/tmp-57b/evidence-sms-notif-staff.txt
SUP="prima_admin_session=57btoken_support_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
MIN="prima_admin_session=57btoken_min_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
: > "$OUT"

echo "════ ۵) sms/notifications — مقصد دقیق redirect (باید /admin/no-access باشد) ════" | tee -a "$OUT"
for p in "/admin/sms" "/admin/notifications" "/admin" "/admin/staff" "/admin/audit" "/admin/settings" "/admin/media"; do
  read -r code loc <<< "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$MIN" "http://localhost:3000$p")"
  ok="✓"; [ "$loc" != "http://localhost:3000/admin/no-access" ] && [ "$code" != "200" ] && ok="⚠️"
  echo "MIN $p → $code ${loc:+→ $loc} $ok" | tee -a "$OUT"
done
echo "--- CONTENT_MANAGER (analyticsRead دارد؛ داشبورد باید 200 شود — کنترل مثبت) ---" | tee -a "$OUT"
for p in "/admin" "/admin/media" "/admin/sms" "/admin/orders"; do
  read -r code loc <<< "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "prima_admin_session=57btoken_content_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" "http://localhost:3000$p")"
  echo "CONTENT $p → $code ${loc:+→ $loc}" | tee -a "$OUT"
done

echo "════ ۶) واریانت‌های تازهٔ URL روی /admin/staff با SUPPORT (بدون usersRead) ════" | tee -a "$OUT"
i=0
while IFS= read -r v; do
  i=$((i+1))
  read -r code loc <<< "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --path-as-is -b "$SUP" "http://localhost:3000$v")"
  echo "S$i $v → $code ${loc:+→ $loc}" | tee -a "$OUT"
done <<'VARIANTS'
/admin/staff/.
/admin/staff/./
/admin/staff%20
/ADMIN/staff
/admin/sTaFf
/admin/staff/..
/admin/staff/..%2Fstaff
/admin/staff?
/admin//staff
/admin/./staff
VARIANTS
echo "--- دنبال‌کردن زنجیرهٔ سه واریانت 3xx ---" | tee -a "$OUT"
for v in "/admin/staff/.." "/admin//staff" "/admin/./staff"; do
  final=$(curl -s -o /dev/null -w '%{url_effective} [%{http_code}]' -L --path-as-is -b "$SUP" "http://localhost:3000$v")
  echo "FOLLOW $v → $final" | tee -a "$OUT"
done
