#!/usr/bin/env bash
# 67-hack — اجرای حمله‌های ۳/۴/۵ روی HTTP (سرور را در صورت مرگ با DATABASE_URL درست بالا می‌آورد)
set -u
cd /home/z/my-project/towel-parima
OUT=qa-reports/tmp-67
A="MOCK-d1c21e963b75305d596658ff"
CODE="5598372938"

health() { curl -s --max-time 4 -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null; }

ensure_server() {
  for i in $(seq 1 30); do [ "$(health)" = "200" ] && return 0; sleep 1; done
  export DATABASE_URL="$(bash scripts/pg.sh url)"
  nohup bash -c 'cd /home/z/my-project/towel-parima && node node_modules/next/dist/bin/next dev -p 3000 2>&1 | tee -a dev.log' >/dev/null 2>&1 &
  for i in $(seq 1 60); do [ "$(health)" = "200" ] && return 0; sleep 1; done
  return 1
}

ensure_server || { echo "SERVER_DOWN"; exit 9; }
echo "[server] up"

SHA=$(printf '%s' "$A" | sha256sum | cut -d' ' -f1)
SHA_UP=$(echo "$SHA" | tr a-f A-F)
SHA1=$(printf '%s' "$A" | sha1sum | cut -d' ' -f1)
MD5=$(printf '%s' "$A" | md5sum | cut -d' ' -f1)
RAND64=$(openssl rand -hex 32)
HMAC=$(printf '%s' "$A" | openssl dgst -sha256 -hmac "prima-dev-pay-proof-secret" -hex | sed 's/^.*= //')

probe_mg() { # $2 = cookie value or empty
  local label="$1" ck="$2"
  if [ -n "$ck" ]; then
    curl -s --max-time 15 -H "Cookie: prima_pay_proof=$ck" "http://localhost:3000/mock-gateway?authority=$A"
  else
    curl -s --max-time 15 "http://localhost:3000/mock-gateway?authority=$A"
  fi
}

: > "$OUT/attack3-proof-results.txt"
for pair in \
  "1_no_cookie|" \
  "2_sha256_forged|$SHA" \
  "3_sha256_upper|$SHA_UP" \
  "4_sha1|$SHA1" \
  "5_md5|$MD5" \
  "6_random_hex64|$RAND64" \
  "7_positive_control_dev_hmac|$HMAC" ; do
  label="${pair%%|*}"; ck="${pair#*|}"
  body=$(probe_mg "$label" "$ck")
  if echo "$body" | grep -q "پرداخت سفارش"; then verdict="AUTHORIZED(amount+code shown)"; else verdict="NOT_FOUND(shown یافت نشد)"; fi
  leaked=$(echo "$body" | grep -c "5598372938\|284,000")
  echo "$label => $verdict (orderCode/amount leaks: $leaked)" | tee -a "$OUT/attack3-proof-results.txt"
done

echo "--- success page with forged sha256 proof ---" | tee -a "$OUT/attack3-proof-results.txt"
b=$(curl -s --max-time 15 -H "Cookie: prima_pay_proof=$SHA" "http://localhost:3000/checkout/success?code=$CODE")
leak=$(echo "$b" | grep -c "$CODE\|284,000\|حوله مهمان")
echo "GET /checkout/success?code=$CODE with forged proof: leaks=$leak (0 = generic page)" | tee -a "$OUT/attack3-proof-results.txt"

# ─────────────── حملهٔ ۴ ───────────────
ensure_server || { echo "SERVER_DOWN4"; exit 9; }
echo "[attack4] 25 parallel NOK flood with nonexistent authority"
: > "$OUT/attack4-flood-codes.txt"
for i in $(seq 1 25); do
  curl -s --max-time 15 -o /dev/null -w "%{http_code}\n" "http://localhost:3000/checkout/callback?authority=HACK67-NOEXIST-$i&status=NOK" >> "$OUT/attack4-flood-codes.txt" &
done
wait
sort "$OUT/attack4-flood-codes.txt" | uniq -c | tee "$OUT/attack4-flood-summary.txt"

echo "[attack4] repeated callback with REAL authority (idempotency)"
: > "$OUT/attack4-idem.txt"
for k in 1 2 3 4; do
  curl -s --max-time 15 -o /dev/null -w "NOK#$k %{http_code} -> %{redirect_url}\n" "http://localhost:3000/checkout/callback?authority=$A&status=NOK" | tee -a "$OUT/attack4-idem.txt"
done
curl -s --max-time 15 -o /dev/null -w "OK-after-FAILED %{http_code} -> %{redirect_url}\n" "http://localhost:3000/checkout/callback?authority=$A&status=OK" | tee -a "$OUT/attack4-idem.txt"

# ─────────────── حملهٔ ۵ ───────────────
ensure_server || { echo "SERVER_DOWN5"; exit 9; }
echo "[attack5] XSS reflection probes"
PAY='<script>alert(1)</script>'
PAY2='<img src=x onerror=alert(1)>'
P='javascript:alert(1)'
enc() { python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$1"; }
E1=$(enc "$PAY"); E2=$(enc "$PAY2"); E3=$(enc "$P")
probe() { # label url
  local label="$1" url="$2" body hdr
  body=$(curl -s --max-time 20 -D "$OUT/.hdr" "$url")
  raw=$(echo "$body" | grep -cF "$PAY")
  raw2=$(echo "$body" | grep -cF "$PAY2")
  rawp=$(echo "$body" | grep -cF "$P")
  csp=$(grep -i "^content-security-policy" "$OUT/.hdr" | head -2 | cut -c1-60 | tr '\n' ';')
  echo "$label => raw_script=$raw raw_img=$raw raw_js=$rawp | CSP: $csp" | tee -a "$OUT/attack5-xss-results.txt"
}
: > "$OUT/attack5-xss-results.txt"
probe "shop_q"              "http://localhost:3000/shop?q=$E1&x=$E2&y=$E3"
probe "shop_category_q"     "http://localhost:3000/shop/all?q=$E1"
probe "order_tracking"      "http://localhost:3000/order-tracking?code=$E1&phone=$E2"
probe "checkout_success"    "http://localhost:3000/checkout/success?code=$E1"
probe "checkout_failed"     "http://localhost:3000/checkout/failed?error=$E1&reason=$E2"
probe "mock_gateway"        "http://localhost:3000/mock-gateway?authority=$E1"
probe "not_found_page"      "http://localhost:3000/$E1"
probe "api_search"          "http://localhost:3000/api/search?q=$E1"
probe "home"                "http://localhost:3000/?x=$E1"
probe "journal"             "http://localhost:3000/journal?q=$E1"
rm -f "$OUT/.hdr"
echo "DONE"
