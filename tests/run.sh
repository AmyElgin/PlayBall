#!/usr/bin/env bash
# Runs the migrations and tests against a throwaway local Postgres.
# Usage: tests/run.sh   (needs Postgres 15+ binaries on PATH or in /usr/lib/postgresql)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
BIN="${BIN:-$(dirname "$(command -v initdb)")}"
DATA="$(mktemp -d)"
PORT="${PORT:-54329}"
chmod 777 "$DATA"

# Postgres refuses to run as root, so use the postgres user when we are root.
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$1"; else bash -c "$1"; fi; }

stop() { as_pg "'$BIN/pg_ctl' -D '$DATA/db' -m fast stop >/dev/null 2>&1" || true; rm -rf "$DATA"; }
trap stop EXIT

as_pg "'$BIN/initdb' -D '$DATA/db' -U postgres -A trust >/dev/null"
as_pg "'$BIN/pg_ctl' -D '$DATA/db' -o '-p $PORT -k $DATA -c TimeZone=UTC' -l '$DATA/log' -w start >/dev/null"

PSQL=("$BIN/psql" -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/tests/supabase_stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  # pg_net is replaced by the stub in supabase_stubs.sql
  grep -v 'create extension if not exists pg_net' "$f" | "${PSQL[@]}"
done
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
"${PSQL[@]}" -o /dev/null -f "$ROOT/tests/test.sql" 2>&1 | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR): +//'
echo "All tests passed"
