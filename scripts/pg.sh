#!/usr/bin/env bash
# pg.sh — مدیریت PostgreSQL پرتابل 16.4 (بدون نیاز به روت/docker)
# استفاده: scripts/pg.sh {init|start|stop|status|restart|url|query '<sql>'}
# دیتابیس: prima — کاربر: prima — پورت: 5432
# توجه: پکیج zonky فقط initdb/pg_ctl/postgres دارد (بدون psql/pg_isready)
set -euo pipefail

ROOT="/home/z/my-project"
PGBIN="$ROOT/.pg/bin"
PGDATA="$ROOT/.pg/data"
PGLOG="$ROOT/.pg/pg.log"
DB_NAME="prima"
DB_USER="prima"
DB_PASS="prima_dev_only"
PGPORT=5432

export LD_LIBRARY_PATH="$ROOT/.pg/lib:${LD_LIBRARY_PATH:-}"

# پکیج zonky مینیمال است: فقط initdb/pg_ctl/postgres دارد — چک آمادگی با pg_ctl status
pg_ready() {
  "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 && \
    "$PGBIN/psql" --version >/dev/null 2>&1 # placeholder — psql موجود نیست
}
# چک واقعی: پینگ TCP با bash (بدون وابستگی خارجی)
tcp_ready() {
  (exec 3<>"/dev/tcp/127.0.0.1/$PGPORT") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1
}

case "${1:-}" in
  init)
    [ -d "$PGDATA" ] && { echo "پیش‌فرض: $PGDATA از قبل موجود است"; exit 0; }
    "$PGBIN/initdb" -D "$PGDATA" -U "$DB_USER" --pwfile=<(echo "$DB_PASS") \
      -E UTF8 --locale=C -A scram-sha-256 >/dev/null
    # تنظیمات سبک برای محیط dev sandbox
    cat >> "$PGDATA/postgresql.conf" <<EOF
listen_addresses = '127.0.0.1'
port = $PGPORT
max_connections = 40
shared_buffers = 128MB
synchronous_commit = off
logging_collector = off
EOF
    echo "initdb انجام شد"
    ;;
  start)
    if tcp_ready; then
      echo "PG در حال اجراست"
      exit 0
    fi
    # double-fork: بقا در برابر پاکسازی درخت پروسه‌ی این محیط
    ( setsid "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGLOG" -w -t 60 start </dev/null >/dev/null 2>&1 & )
    for i in $(seq 1 30); do
      tcp_ready && break
      sleep 1
    done
    tcp_ready || { echo "شکست در start — لاگ: $PGLOG"; tail -5 "$PGLOG"; exit 1; }
    echo "PG start شد"
    # دیتابیس prima توسط prisma migrate dev (چون کاربر CREATEDB دارد) ساخته می‌شود
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop || true
    echo "PG stop شد"
    ;;
  status)
    "$PGBIN/pg_ctl" -D "$PGDATA" status && tcp_ready && echo "TCP 127.0.0.1:$PGPORT آماده" || true
    ;;
  restart)
    "$0" stop; "$0" start
    ;;
  url)
    echo "postgresql://$DB_USER:$DB_PASS@127.0.0.1:$PGPORT/$DB_NAME?schema=public"
    ;;
  query)
    # بدون psql در پکیج مینیمال — SQL از طریق Prisma CLI اجرا می‌شود
    cd "$ROOT" && DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:$PGPORT/$DB_NAME?schema=public" \
      bunx prisma db execute --schema prisma/schema.prisma --stdin <<< "${2:-SELECT 1}"
    ;;
  *)
    echo "استفاده: $0 {init|start|stop|status|restart|url|query '<sql>'}"
    exit 1
    ;;
esac
