#!/usr/bin/env bash
# Sao luu CSDL: pg_dump -> nen -> ma hoa bang age -> file .sql.gz.age
# Bien moi truong: DB_URL (chuoi ket noi Postgres), AGE_PUBLIC_KEY (khoa cong khai age, bat dau bang "age1")
# Dung boi .github/workflows/backup.yml, cung co the chay tay.
set -euo pipefail
: "${DB_URL:?Thieu DB_URL}"
: "${AGE_PUBLIC_KEY:?Thieu AGE_PUBLIC_KEY}"
OUT_DIR="${OUT_DIR:-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/family-hub-$STAMP.sql.gz.age"
# Chi sao luu du lieu cua ung dung (public) va tai khoan (auth). Khong in DB_URL ra log.
pg_dump "$DB_URL" --schema=public --schema=auth --no-owner --no-privileges \
  | gzip -9 \
  | age -r "$AGE_PUBLIC_KEY" -o "$OUT"
test -s "$OUT"
echo "Da tao $OUT ($(du -h "$OUT" | cut -f1))"
