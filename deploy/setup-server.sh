#!/bin/sh
# Dựng máy chủ cho Travel-AI: Oracle Cloud Ampere A1, Ubuntu 24.04 aarch64 (chạy được cả trên
# Ubuntu x86). Xem claude_production.md, Bước 4. Chạy MỘT lần bằng user mặc định `ubuntu`:
#
#   curl -fsSLO https://raw.githubusercontent.com/NMinh-123/Travel-AI/main/deploy/setup-server.sh
#   sudo sh setup-server.sh
#
# Chạy lại nhiều lần không hỏng gì. Script KHÔNG tạo tệp .env và KHÔNG chép chứng chỉ: hai thứ đó
# là bí mật, phải tự đặt lên máy (hướng dẫn in ra ở cuối).
set -eu

APP_DIR=/opt/travel-ai
DEPLOY_USER=deploy
REPO=https://github.com/NMinh-123/Travel-AI.git
BACKUP_DIR=/var/backups/travelai

[ "$(id -u)" -eq 0 ] || { echo "Chạy bằng sudo: sudo sh setup-server.sh" >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "== 1/6 Cập nhật bảo mật tự động"
apt-get update -q
apt-get install -y -q unattended-upgrades ca-certificates curl git cron
# Bật hai dòng APT::Periodic trong /etc/apt/apt.conf.d/20auto-upgrades.
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== 2/6 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
# Log của container xoay vòng, nếu không một tiến trình nói nhiều sẽ lấp đầy ổ 200 GB theo thời gian.
if [ ! -f /etc/docker/daemon.json ]; then
  printf '{\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "10m", "max-file": "3" }\n}\n' \
    > /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker

echo "== 3/6 User $DEPLOY_USER, SSH chỉ bằng khoá"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
# Dùng lại khoá SSH đã khai lúc tạo instance (nằm ở user ubuntu), để đăng nhập được ngay.
if [ ! -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ] && [ -s /home/ubuntu/.ssh/authorized_keys ]; then
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /home/ubuntu/.ssh/authorized_keys \
    "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi
[ -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ] || {
  echo "Chưa có khoá SSH cho $DEPLOY_USER. Dừng trước khi tắt đăng nhập mật khẩu để không tự khoá mình ngoài." >&2
  exit 1
}
cat > /etc/ssh/sshd_config.d/10-travel-ai.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
# Ubuntu 24.04 bật SSH theo socket activation: ssh.service có thể chưa chạy lần nào, nên
# /run/sshd chưa có (sshd -t báo "Missing privilege separation directory") và `reload` sẽ lỗi.
# try-reload-or-restart không làm gì khi service chưa chạy; kết nối mới vẫn đọc cấu hình mới.
mkdir -p /run/sshd
sshd -t
systemctl try-reload-or-restart ssh

echo "== 4/6 Mã nguồn ở $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --depth 1 "$REPO" "$APP_DIR"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR/deploy/certs"

echo "== 5/6 Dải IP Cloudflare vào .env (CF_IPS)"
# Lấy lúc chạy chứ không ghi cứng: Cloudflare thỉnh thoảng thêm dải. Chạy lại script để cập nhật.
cf=$(curl -fsS https://www.cloudflare.com/ips-v4; echo; curl -fsS https://www.cloudflare.com/ips-v6)
cf=$(printf '%s\n' "$cf" | grep -E '^[0-9a-f.:]+/[0-9]+$' | tr '\n' ' ' | sed 's/ $//')
[ -n "$cf" ] || { echo "Không lấy được dải IP Cloudflare." >&2; exit 1; }
touch "$APP_DIR/.env"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
# Sửa đúng một dòng, không đụng phần còn lại của tệp (có bí mật trong đó).
grep -v '^CF_IPS=' "$APP_DIR/.env" > "$APP_DIR/.env.tmp" || true
printf 'CF_IPS=%s\n' "$cf" >> "$APP_DIR/.env.tmp"
cat "$APP_DIR/.env.tmp" > "$APP_DIR/.env"
rm -f "$APP_DIR/.env.tmp"

echo "== 6/6 Sao lưu database hằng ngày (02:17 giờ Việt Nam)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$BACKUP_DIR"
cat > /etc/cron.d/travel-ai-backup <<EOF
17 19 * * * $DEPLOY_USER ENV_FILE=$APP_DIR/.env BACKUP_DIR=$BACKUP_DIR KEEP=7 sh $APP_DIR/scripts/backup-db.sh >> $BACKUP_DIR/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/travel-ai-backup

cat <<EOF

Xong phần máy chủ. Còn lại (làm bằng user $DEPLOY_USER: ssh $DEPLOY_USER@<IP>):
  1. Điền $APP_DIR/.env (chmod 600 đã đặt). Danh sách biến: claude_production.md, Bước 4.
     Mật khẩu trong DATABASE_URL phải mã hoá URL (\$ thành %24, & thành %26, % thành %25),
     vì docker compose diễn giải ký tự \$ trong tệp env.
  2. Đặt Cloudflare Origin Certificate vào $APP_DIR/deploy/certs/origin.pem và origin.key
     (chmod 600) — Bước 5.
  3. cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d --build
     Lần đầu build trên máy ARM và tải model BGE-M3 (khoảng 2,2 GB), mất một lúc.
  4. Kiểm: curl -s http://127.0.0.1:3000/api/health
EOF
