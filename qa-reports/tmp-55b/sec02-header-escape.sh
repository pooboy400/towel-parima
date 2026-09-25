#!/usr/bin/env bash
# SEC-02 step2: تلاش فرار از bucket مشترک با هدر — همه باید 429 بمانند
URL=http://localhost:3000/api/health
declare -a NAMES=(
 "xff-single" "xff-multihop" "xff-first-ext-last-int" "xff-last-ext" "xff-internal-10" "xff-internal-192"
 "x-real-ip" "true-client-ip" "cf-connecting-ip" "forwarded-std" "xff-dup-2lines"
 "ipv6-full" "ipv6-short" "ipv6-fe80" "zero-addr" "broken" "long-5k" "empty-xff" "combo-all"
)
run() { # name, extra curl args...
  local n=$1; shift
  c1=$(curl -s -o /dev/null -w '%{http_code}' "$@" "$URL")
  c2=$(curl -s -o /dev/null -w '%{http_code}' "$@" "$URL")
  echo "$n: $c1 $c2"
}
run xff-single            -H "X-Forwarded-For: 1.2.3.4"
run xff-multihop          -H "X-Forwarded-For: 1.2.3.4, 10.0.0.9, 198.51.100.7"
run xff-first-ext-last-int -H "X-Forwarded-For: 198.51.100.7, 10.0.0.9"
run xff-last-ext          -H "X-Forwarded-For: 10.0.0.9, 203.0.113.9"
run xff-internal-10       -H "X-Forwarded-For: 10.99.0.5"
run xff-internal-192      -H "X-Forwarded-For: 192.168.1.50"
run x-real-ip             -H "X-Real-IP: 8.8.8.8"
run true-client-ip        -H "True-Client-IP: 8.8.4.4"
run cf-connecting-ip      -H "CF-Connecting-IP: 104.16.1.1"
run forwarded-std         -H "Forwarded: for=1.2.3.4;proto=http"
run xff-dup-2lines        -H "X-Forwarded-For: 1.2.3.4" -H "X-Forwarded-For: 5.6.7.8"
run ipv6-full             -H "X-Forwarded-For: 2001:0db8:0000:0000:0000:0000:0000:0001"
run ipv6-short            -H "X-Forwarded-For: 2606:4700::1111"
run ipv6-fe80             -H "X-Forwarded-For: fe80::1"
run zero-addr             -H "X-Forwarded-For: 0.0.0.0"
run broken                -H "X-Forwarded-For: not-an-ip"
longh=$(head -c 5000 /dev/zero | tr '\0' 'a')
run long-5k               -H "X-Forwarded-For: $longh"
run empty-xff             -H "X-Forwarded-For:"
run combo-all             -H "X-Forwarded-For: 9.9.9.9" -H "X-Real-IP: 9.9.9.8" -H "True-Client-IP: 9.9.9.7" -H "CF-Connecting-IP: 9.9.9.6" -H "Forwarded: for=9.9.9.5"
echo "---- double-check بدون هیچ هدری ----"
for i in 1 2 3; do curl -s -o /dev/null -w "%{http_code} " "$URL"; done; echo ""
