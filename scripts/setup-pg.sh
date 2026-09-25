#!/usr/bin/env bash
# setup-pg.sh — بازنصب PostgreSQL پرتابل zonky در .pg/ (بازیابی محیط)
set -euo pipefail

ROOT="/home/z/my-project"
PG_DIR="$ROOT/.pg"
BIN="$PG_DIR/bin"
VERSION="16.4.0"
JAR_URL="https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-linux-amd64/${VERSION}/embedded-postgres-binaries-linux-amd64-${VERSION}.jar"
TMP="$PG_DIR/tmp"

mkdir -p "$TMP"
cd "$TMP"

if [ ! -f "pg.jar" ]; then
  echo "دانلود zonky postgres $VERSION ..."
  curl -fSL --retry 3 -o pg.jar "$JAR_URL"
fi

echo "استخراج txz از jar ..."
unzip -o -q pg.jar postgres-linux-x86_64.txz

mkdir -p "$BIN"
echo "استخراج باینری‌ها (چند دقیقه طول می‌کشد) ..."
tar -xJf postgres-linux-x86_64.txz -C "$BIN"

# ساختار txz: bin/lib/share در ریشه — باینری‌ها در $BIN/bin هستند؛ هم‌تراز با pg.sh:
if [ -d "$BIN/bin" ]; then
  mv "$BIN/bin"/* "$BIN"/ 2>/dev/null || true
  rmdir "$BIN/bin" 2>/dev/null || true
fi
# کتابخانه‌ها و share به .pg/lib و .pg/share (pg.sh از .pg/lib استفاده می‌کند)
[ -d "$BIN/lib" ] && mv "$BIN/lib" "$PG_DIR/lib"
[ -d "$BIN/share" ] && mv "$BIN/share" "$PG_DIR/share"

chmod +x "$BIN"/initdb "$BIN"/pg_ctl "$BIN"/postgres 2>/dev/null || true
export LD_LIBRARY_PATH="$PG_DIR/lib:${LD_LIBRARY_PATH:-}"

echo "باینری‌ها:"
ls "$BIN" | head -10
"$BIN/postgres" --version
echo "نصب کامل شد ✓"
