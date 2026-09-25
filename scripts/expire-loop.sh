#!/usr/bin/env bash
# expire-loop.sh — حلقه worker انقضای رزرو (هر ۵ دقیقه) برای محیط dev/sandbox
set -u
cd /home/z/my-project
while true; do
  bun scripts/expire-reservations.ts 2>/dev/null | head -1
  sleep 300
done
