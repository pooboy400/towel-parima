#!/usr/bin/env bash
# SEC-04 — سفارش مهمان واقعی روی سرور زنده (Server Action با action-id از chunk کلاینت)
ACTION_ID=$(rg -o '__next_internal_action_entry_do_not_use__ \[\{"([0-9a-f]{40})":\{"name":"placeOrderAction"' -r '$1' /home/z/my-project/towel-parima/.next/dev/static/chunks/src_1f602cz._.js 2>/dev/null | head -1)
[ -z "$ACTION_ID" ] && ACTION_ID="4049d9bfabba17e14137d15792830662f22cbb9ee6"
echo "action-id=$ACTION_ID"
JAR_A=/home/z/my-project/towel-parima/qa-reports/tmp-55b/jar-A.txt
rm -f "$JAR_A"
RESP=$(curl -s -D headers-A.txt -c "$JAR_A" -X POST http://localhost:3000/checkout \
  -H "Next-Action: $ACTION_ID" \
  -F '0=[{"lines":[{"lineId":"p1__cream__bath-large","quantity":1}],"address":{"fullName":"QA55B Tester","phone":"09125550001","province":"Tehran","city":"Tehran","postalCode":"1111111111","line":"Test Street No.55, Unit 2, QA 55b"},"shippingMethod":"standard"}]')
echo "$RESP" | rg '^1:' | head -1
echo "--- Set-Cookie در پاسخ action ---"
rg -i "set-cookie" headers-A.txt
