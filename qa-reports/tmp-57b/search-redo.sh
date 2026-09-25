#!/usr/bin/env bash
# Task 57-b — جبران: تخلیهٔ search با کوئری encode‌شده + ثبت Retry-After
cd /home/z/my-project/towel-parima
OUT=qa-reports/tmp-57b/evidence-search-redo.txt
: > "$OUT"
Q="%D8%AD%D9%88%D9%84%D9%87" # «حوله»
seq 1 30 | xargs -P 8 -I{} curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/search?q=$Q" > qa-reports/tmp-57b/s2.txt
echo "۳۰ درخواست encode‌شده: $(sort qa-reports/tmp-57b/s2.txt | uniq -c | tr '\n' ' ')" | tee -a "$OUT"
curl -s -D - -o /dev/null "http://localhost:3000/api/search?q=$Q" | grep -i "^HTTP\|retry-after" | tr '\r' ' ' | tr '\n' ' '; echo " ← hit 31" | tee -a "$OUT"
curl -s -o /dev/null -w "بدون q (باید 200 خالی باشد و شمرده شود): %{http_code}\n" "http://localhost:3000/api/search" | tee -a "$OUT"
