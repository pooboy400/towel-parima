#!/usr/bin/env bash
# 67-hack — حملهٔ ۳ (تسک): Origin/Host — ۸ پروب روی گارد BUG-14 در proxy.ts
cd /home/z/my-project/towel-parima
OUT=qa-reports/tmp-67
URL="http://localhost:3000/api/health"
: > "$OUT/attack-origin-results.txt"
probe() { # label extra-curl-args...
  local label="$1"; shift
  local hdr body code
  hdr=$(mktemp)
  body=$(curl -s --max-time 15 -D "$hdr" -o /dev/null -w "%{http_code}" "$@" -X POST "$URL")
  local ct
  ct=$(grep -i "^content-type" "$hdr" | head -1 | tr -d '\r')
  local codejson
  codejson=$(curl -s --max-time 15 "$@" -X POST "$URL" | head -c 200 | tr -d '\n')
  echo "$label => HTTP $body | $ct | body: $codejson" | tee -a "$OUT/attack-origin-results.txt"
  rm -f "$hdr"
}
probe "P1_origin_evil_normal_host"      -H "Origin: https://evil.example.com"
probe "P2_origin_evil_XFH_evil"         -H "Origin: https://evil.example.com" -H "x-forwarded-host: evil.example.com"
probe "P3_suffix_trick"                 -H "Origin: https://localhost:3000.evil.example.com"
probe "P4_origin_null"                  -H "Origin: null"
probe "P5_origin_same_host"             -H "Origin: http://localhost:3000"
probe "P6_origin_wildcard_sandbox"      -H "Origin: https://test.space-z.ai" -H "x-forwarded-host: test.space-z.ai"
probe "P7_origin_malformed"             -H "Origin: ::::not-a-url"
probe "P8_origin_port_diff"             -H "Origin: http://localhost:3000:8080"
probe "P9_host_header_evil"             -H "Host: evil.example.com" -H "Origin: https://evil.example.com"
probe "P10_origin_evil_XFH_sandbox"     -H "Origin: https://evil.example.com" -H "x-forwarded-host: preview.space-z.ai"
echo DONE
