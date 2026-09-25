#!/usr/bin/env bash
# Task 57-b — بردار ۲: قاچاق بدنه در /api/csp-report (زنده)
cd /home/z/my-project/towel-parima
OUT=qa-reports/tmp-57b/evidence-csp.txt
BASE=$(wc -l < dev.log)
: > "$OUT"
req() { # req <label> <curl-args...>
  local label="$1"; shift
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$@" http://localhost:3000/api/csp-report)
  echo "[$label] status=$code" | tee -a "$OUT"
}
JS='{"csp-report":{"document-uri":"https://prima.example/x","violated-directive":"script-src"}}'
PAD=$(printf 'A%.0s' $(seq 1 3800))

echo "=== baseline dev.log=$BASE ===" | tee -a "$OUT"
req "R0-سالم 228B"            -X POST -H 'Content-Type: application/json' --data-binary "$JS"
req "R1-CL=9000 بدنه=100B"    -X POST -H 'Content-Type: application/json' -H 'Content-Length: 9000' --data-binary "$JS"
req "R2-CL=-5 بدنهٔ سالم"     -X POST -H 'Content-Type: application/json' -H 'Content-Length: -5' --data-binary "$JS"
req "R3-CL=1e20"              -X POST -H 'Content-Type: application/json' -H 'Content-Length: 99999999999999999999' --data-binary "$JS"
req "R4-CL=abc (NaN)"         -X POST -H 'Content-Type: application/json' -H 'Content-Length: abc' --data-binary "$JS"
req "R5-دو CL تکراری 50/50"   -X POST -H 'Content-Type: application/json' -H 'Content-Length: 50' -H 'Content-Length: 50' --data-binary "$JS"
req "R6-chunked+CL همزمان"    -X POST -H 'Content-Type: application/json' -H 'Transfer-Encoding: chunked' -H 'Content-Length: 83' --data-binary "$JS"
# R7 — دقیقاً 4096 بایت (JSON معتبر با padding)
python3 - "$JS" <<'PY' > qa-reports/tmp-57b/body-4096.json
import json,sys
base=json.loads(sys.argv[1]); base["pad"]="A"*3000
s=json.dumps(base)
sys.stdout.write(s if len(s)<=4096 else s[:4096])
PY
# تنظیم دقیق طول به 4096
python3 - "$JS" <<'PY' > qa-reports/tmp-57b/body-4096.json
import json,sys
base=json.loads(sys.argv[1]); target=4096
s=json.dumps(base); pad=target-len(s)-len(',"pad":""')-0
pad=max(0,target-len(s)-9)
base["pad"]="A"*pad; s=json.dumps(base)
while len(s)<target: base["pad"]+="A"; s=json.dumps(base)
while len(s)>target: base["pad"]=base["pad"][:-1]; s=json.dumps(base)
sys.stdout.write(s)
PY
python3 - "$JS" <<'PY' > qa-reports/tmp-57b/body-4097.json
import json,sys
base=json.loads(sys.argv[1]); target=4097
s=json.dumps(base)
while len(s)<target: base["pad"]=(base.get("pad","")+"A"); s=json.dumps(base)
while len(s)>target: base["pad"]=base["pad"][:-1]; s=json.dumps(base)
sys.stdout.write(s)
PY
echo "R7 body len: $(wc -c < qa-reports/tmp-57b/body-4096.json) / R8 body len: $(wc -c < qa-reports/tmp-57b/body-4097.json)" | tee -a "$OUT"
req "R7-بدنه دقیقاً 4096"     -X POST -H 'Content-Type: application/json' --data-binary @qa-reports/tmp-57b/body-4096.json
req "R8-بدنه دقیقاً 4097"     -X POST -H 'Content-Type: application/json' --data-binary @qa-reports/tmp-57b/body-4097.json
req "R9-JSON نامعتبر 1KB"     -X POST -H 'Content-Type: application/json' --data-binary "{\"broken\": $PAD"
req "R10-HEAD"                -I -X HEAD
req "R10b-PUT"                -X PUT --data-binary "$JS"
head -c 102400 /dev/zero | tr '\0' 'A' > qa-reports/tmp-57b/body-100k.txt
req "R11-chunked 100KB"       -X POST -H 'Content-Type: application/json' -H 'Transfer-Encoding: chunked' --data-binary @qa-reports/tmp-57b/body-100k.txt

echo "=== رکوردهای dev.log بعد از تست‌ها (خط‌ها) ===" | tee -a "$OUT"
tail -n +$((BASE+1)) dev.log | grep -n "csp" | tee -a "$OUT"
echo "=== بررسی نشت خطا/استک (باید خالی باشد) ===" | tee -a "$OUT"
tail -n +$((BASE+1)) dev.log | grep -in "error\|stack\|SyntaxError\|Unexpected" | grep -v "csp" | tee -a "$OUT" || echo "(هیچ — سکوت مسیر خطا تأیید شد)" | tee -a "$OUT"
