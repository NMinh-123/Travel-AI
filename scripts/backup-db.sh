#!/bin/sh
# Sao lưu database ra một tệp pg_dump, giữ KEEP bản gần nhất. Chạy trên VPS theo lịch (cron).
#
#   DATABASE_URL=postgresql://... BACKUP_DIR=/var/backups/travelai KEEP=7 sh scripts/backup-db.sh
#
# Vì sao cần: Supabase Free KHÔNG có backup tự động. Script chạy pg_dump trong container
# postgres:17 nên VPS không phải cài client Postgres, và client 17 đọc được server 15-17.
#
# Chỉ dump schema `public`: ứng dụng chỉ dùng schema này (kể cả bảng _prisma_migrations), còn
# các schema auth/storage/... là của Supabase và khôi phục đè lên chúng sẽ hỏng project.
# `--extension` là BẮT BUỘC: với `--schema`, pg_dump bỏ qua extension, và khôi phục vào một
# database trống thì bảng KnowledgeDoc (cột vector) không tạo được — đã thử và hỏng đúng như vậy.
#
# Khôi phục (nên thử một lần vào một database tạm trước khi cần thật):
#   docker run --rm -i postgres:17-alpine pg_restore --no-owner --no-privileges \
#     --clean --if-exists -d "$TARGET_URL" < travelai-<thời điểm>.dump
# Khôi phục vào server Postgres 16 sẽ báo đúng một lỗi `unrecognized configuration parameter
# "transaction_timeout"` (tham số của client 17); lỗi đó vô hại, dữ liệu vẫn vào đủ.
set -eu

: "${DATABASE_URL:?Thiếu DATABASE_URL}"
dir="${BACKUP_DIR:-/var/backups/travelai}"
keep="${KEEP:-7}"
mkdir -p "$dir"

file="$dir/travelai-$(date -u +%Y%m%dT%H%M%SZ).dump"
# Ghi ra tệp tạm rồi mới đổi tên: pg_dump hỏng giữa chừng thì không để lại một bản trông như
# bản tốt, và vòng xoá bản cũ bên dưới không đếm nó.
docker run --rm -e PGURL="$DATABASE_URL" postgres:17-alpine \
  sh -c 'pg_dump --format=custom --no-owner --no-privileges --schema=public \
    --extension=vector --extension=unaccent "$PGURL"' > "$file.tmp"
mv "$file.tmp" "$file"
echo "Đã sao lưu: $file ($(wc -c < "$file") byte)"

# Giữ KEEP bản mới nhất, xoá phần còn lại.
ls -1t "$dir"/travelai-*.dump | tail -n +"$((keep + 1))" | while read -r old; do rm -f -- "$old"; done
