#!/usr/bin/env bash
# Chay moi file supabase/tests/rls_*.sql (tru rls_helpers.sql, rls_fixture.sql), moi file tren mot CSDL moi.
# Khong can Supabase/Docker; can psql va quyen tao CSDL tam. Thoat khac 0 neu co kiem tra that bai.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PSQL="psql -X -q -v ON_ERROR_STOP=1"
status=0
for t in "$HERE"/rls_*.sql; do
  name="$(basename "$t")"
  case "$name" in rls_helpers.sql|rls_fixture.sql) continue;; esac
  DB="fh_rls_test_$$"
  createdb "$DB" || exit 2
  echo "### $name"
  out="$( ( $PSQL -d "$DB" -f "$HERE/00_stub_supabase.sql" \
        && for f in "$HERE"/../migrations/*.sql; do $PSQL -d "$DB" -f "$f" || exit 1; done \
        && $PSQL -d "$DB" -f "$HERE/rls_helpers.sql" \
        && $PSQL -d "$DB" -f "$t" ) 2>&1 )" || status=1
  echo "$out" | grep -E 'FAIL|KET QUA|ERROR' || true
  echo "$out" | grep -q 'KET QUA' || { echo "KHONG CO KET QUA (loi khi chay)"; echo "$out" | tail -15; status=1; }
  echo "$out" | grep -E 'KET QUA: [0-9]+ dat, [1-9][0-9]* that bai' >/dev/null && status=1
  dropdb --if-exists "$DB"
done
exit $status
