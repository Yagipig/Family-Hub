#!/usr/bin/env bash
# Kiem tra mot ban sao luu co khoi phuc duoc khong, tren Postgres CUC BO (khong dong vao production).
# Cach dung: AGE_KEY_FILE=khoa-rieng.txt ./scripts/restore-verify.sh backups/family-hub-XXXX.sql.gz.age
# Can: psql, createdb, dropdb, age, gzip va quyen tao CSDL tam tren may.
set -euo pipefail
BACKUP="${1:?Cho biet duong dan file sao luu}"
: "${AGE_KEY_FILE:?Thieu AGE_KEY_FILE (file khoa rieng age)}"
DB="fh_restore_check_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -X -q -d "$DB" -v ON_ERROR_STOP=1 -c "
  do \$\$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end \$\$;
  create schema if not exists extensions;" >/dev/null
age -d -i "$AGE_KEY_FILE" "$BACKUP" | gunzip | psql -X -q -d "$DB" -v ON_ERROR_STOP=0 >/tmp/restore.log 2>&1 || true
echo "So dong trong cac bang chinh sau khi khoi phuc:"
psql -X -d "$DB" -At -c "
  select 'families', count(*) from public.families union all
  select 'branches', count(*) from public.branches union all
  select 'family_memberships', count(*) from public.family_memberships union all
  select 'invitations', count(*) from public.invitations union all
  select 'audit_logs', count(*) from public.audit_logs union all
  select 'auth.users', count(*) from auth.users;"
echo "Chi tiet loi (neu co): /tmp/restore.log"
