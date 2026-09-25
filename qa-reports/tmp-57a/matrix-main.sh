#!/bin/bash
# ماتریس نقش×مسیر ۱۵ مسیر اصلی — 57-a
SA="sec57a_super_admin_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
SP="sec57a_support_agent_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
SM="sec57a_store_manager_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
declare -A CK=( [SUPER_ADMIN]=$SA [SUPPORT_AGENT]=$SP [STORE_MANAGER]=$SM )
ROUTES="/admin /admin/staff /admin/audit /admin/settings /admin/orders /admin/messages /admin/products /admin/reviews /admin/journal /admin/media /admin/faq /admin/categories /admin/collections /admin/sms /admin/notifications"
for R in $ROUTES; do
  for ROLE in SUPER_ADMIN SUPPORT_AGENT STORE_MANAGER; do
    OUT=$(curl -s -o /dev/null --max-time 120 -w "%{http_code} %{redirect_url}" -H "Cookie: prima_admin_session=${CK[$ROLE]}" "http://localhost:3000$R")
    echo "$R|$ROLE|$OUT"
    sleep 0.3
  done
done
