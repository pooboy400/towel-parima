#!/usr/bin/env bash
# SEC-02 step1: خالی‌کردن bucket /api/health (سقف 120/min) — انتظار: 120×200 سپس 5×429
EV=/home/z/my-project/towel-parima/qa-reports/tmp-55b
URL=http://localhost:3000/api/health
for i in $(seq 1 125); do
  printf "%s " "$(curl -s -o /dev/null -w '%{http_code}' "$URL")"
  if [ $((i % 25)) -eq 0 ]; then echo "(n=$i)"; fi
done
echo ""
