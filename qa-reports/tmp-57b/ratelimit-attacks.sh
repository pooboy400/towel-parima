#!/usr/bin/env bash
# Task 57-b — بردار ۴: Retry-After و race سقف + بردار ۶-الف: ترفندهای XFF تازه
cd /home/z/my-project/towel-parima
OUT=qa-reports/tmp-57b/evidence-ratelimit-retryafter.txt
: > "$OUT"

echo "════ ۱) health: ۱۰۰ متوالی روی bucket سرد ════" | tee -a "$OUT"
seq 1 100 | xargs -P 10 -I{} curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health > qa-reports/tmp-57b/h1.txt
echo "متوالی ۱۰۰: $(sort qa-reports/tmp-57b/h1.txt | uniq -c | tr '\n' ' ')" | tee -a "$OUT"

echo "════ ۲) انفجار موازی ۶۰تایی (xargs -P 50) — bucket در ۱۰۰ ════" | tee -a "$OUT"
seq 1 60 | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health > qa-reports/tmp-57b/h2.txt
echo "موازی ۶۰: $(sort qa-reports/tmp-57b/h2.txt | uniq -c | tr '\n' ' ')" | tee -a "$OUT"
T200=$(( $(grep -c 200 qa-reports/tmp-57b/h1.txt) + $(grep -c 200 qa-reports/tmp-57b/h2.txt) ))
echo "جمع 200ها در همین پنجره: $T200 (سقف=120؛ اگر بیشتر = race شمارنده)" | tee -a "$OUT"

echo "════ ۳) Retry-After در 429های health ════" | tee -a "$OUT"
for i in 1 2 3; do
  curl -s -D - -o /dev/null http://localhost:3000/api/health | grep -i "^HTTP\|retry-after" | tr '\r' ' ' | tr '\n' ' ' ; echo
done | tee -a "$OUT"

echo "════ ۴) media-file: تخلیهٔ bucket (۱۲۲ درخواست 404) ════" | tee -a "$OUT"
seq 1 118 | xargs -P 12 -I{} curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/media/file/no-such-file-57b.webp > qa-reports/tmp-57b/m1.txt
echo "۱۱۸تایی: $(sort qa-reports/tmp-57b/m1.txt | uniq -c | tr '\n' ' ')" | tee -a "$OUT"
curl -s -D - -o /dev/null http://localhost:3000/api/media/file/no-such-file-57b.webp | grep -i "^HTTP\|retry-after" | tr '\r' ' ' | tr '\n' ' '; echo " ← hit 119" | tee -a "$OUT"
curl -s -D - -o /dev/null http://localhost:3000/api/media/file/no-such-file-57b.webp | grep -i "^HTTP\|retry-after" | tr '\r' ' ' | tr '\n' ' '; echo " ← hit 120" | tee -a "$OUT"

echo "════ ۵) search: ۳۱ درخواست ════" | tee -a "$OUT"
seq 1 30 | xargs -P 8 -I{} curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/search?q=حوله" > qa-reports/tmp-57b/s1.txt
echo "۳۰تایی: $(sort qa-reports/tmp-57b/s1.txt | uniq -c | tr '\n' ' ')" | tee -a "$OUT"
curl -s -D - -o /dev/null "http://localhost:3000/api/search?q=حوله" | grep -i "^HTTP\|retry-after" | tr '\r' ' ' | tr '\n' ' '; echo " ← hit 31" | tee -a "$OUT"

echo "════ ۶) ترفندهای XFF تازه در حالت 429 (نباید bucket تازه بگیرند) ════" | tee -a "$OUT"
trick() {
  local label="$1"; shift
  local out
  out=$(curl -s -o /dev/null -w "%{http_code}" "$@" http://localhost:3000/api/health)
  echo "XFF-trick [$label] → $out (429=شکست حمله ✓ / 200=فرار ⚠️)" | tee -a "$OUT"
}
trick "XFF با تب+quoted"        -H $'X-Forwarded-For: "203.0.113.9"'
trick "XFF chain با unknown"    -H "X-Forwarded-For: unknown, 203.0.113.9"
trick "x-real-ip mapped IPv6"   -H "X-Real-IP: ::ffff:203.0.113.9"
trick "XFF با نقطهٔ یونیکد"      -H $'X-Forwarded-For: 203\u002e0\u002e113\u002e9'
trick "Forwarded با port"       -H "Forwarded: for=203.0.113.9:443;by=10.0.0.1"
trick "XFF چندخطی"              -H $'X-Forwarded-For: 203.0.113.9,\n\t198.51.100.7'
