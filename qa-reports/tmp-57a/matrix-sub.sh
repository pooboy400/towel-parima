#!/bin/bash
# زیرصفحه‌ها + کنترل بدون‌نشست + no-access — 57-a
SA="sec57a_super_admin_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
SP="sec57a_support_agent_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
SM="sec57a_store_manager_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
declare -A CK=( [SUPER_ADMIN]=$SA [SUPPORT_AGENT]=$SP [STORE_MANAGER]=$SM )
OID="cmuhc8rwg0011lt6iucwnaj4h"
JID="cmuh89ry0005llt0u2bljkf8e"
ROUTES="/admin/orders/$OID /admin/orders/$OID/invoice /admin/products/new /admin/products/p1/edit /admin/journal/new /admin/journal/$JID /admin/no-access"
for R in $ROUTES; do
  for ROLE in SUPER_ADMIN SUPPORT_AGENT STORE_MANAGER; do
    OUT=$(curl -s -o /dev/null --max-time 120 -w "%{http_code} %{redirect_url}" -H "Cookie: prima_admin_session=${CK[$ROLE]}" "http://localhost:3000$R")
    echo "$R|$ROLE|$OUT"
    sleep 0.3
  done
done
echo "--- NO-SESSION CONTROL ---"
for R in /admin/staff /admin/orders /admin/products /admin /admin/sms /admin/notifications; do
  OUT=$(curl -s -o /dev/null --max-time 60 -w "%{http_code} %{redirect_url}" "http://localhost:3000$R")
  echo "no-session|$R|$OUT"
done
