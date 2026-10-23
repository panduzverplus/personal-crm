#!/usr/bin/env bash
# One-time server preparation: Docker, nginx, one HTTPS certificate for the landing and the app,
# Docker access for the deploy user.
# Usage, on the server from a copy of deploy/server:
#   sudo bash setup-server.sh <letsencrypt-email>
# Safe to re-run: finished steps are skipped or repeated without harm.
set -euo pipefail

EMAIL="${1:?usage: sudo bash setup-server.sh <letsencrypt-email>}"
LANDING_DOMAIN="chigabugadaga.ru"
APP_DOMAIN="app.chigabugadaga.ru"
CERT_NAME="$LANDING_DOMAIN"
DEPLOY_USER="crmapp"
HERE="$(cd "$(dirname "$0")" && pwd)"
LOG=/var/log/server-setup.log

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo" >&2; exit 1; }

# The log is world-readable so the result can be checked without sudo.
touch "$LOG" && chmod 644 "$LOG"
exec > >(tee -a "$LOG") 2>&1
trap 'echo "FAILED at line $LINENO" >&2' ERR

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l
step() { printf '\n=== %s ===\n' "$*"; }

step "Docker"
if ! command -v docker >/dev/null; then
  apt-get update -q
  apt-get install -y -q ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Docker bypasses ufw, so container ports are published on 127.0.0.1 only; container logs are capped.
if ! cmp -s "$HERE/docker-daemon.json" /etc/docker/daemon.json; then
  install -m 644 "$HERE/docker-daemon.json" /etc/docker/daemon.json
  systemctl restart docker
fi
docker --version
docker compose version

step "Docker publishes ports on 127.0.0.1 only"
# One container on the default network and one on a user-defined network, like docker compose creates.
docker rm -f port-check-default port-check-compose >/dev/null 2>&1 || true
docker network rm port-check >/dev/null 2>&1 || true
docker network create port-check >/dev/null
docker run -d --name port-check-default -p 18080:80 busybox:stable sleep 60 >/dev/null
docker run -d --name port-check-compose --network port-check -p 18081:80 busybox:stable sleep 60 >/dev/null
bindings="$(docker port port-check-default; docker port port-check-compose)"
docker rm -f port-check-default port-check-compose >/dev/null
docker network rm port-check >/dev/null
docker rmi busybox:stable >/dev/null 2>&1 || true
echo "$bindings"
if echo "$bindings" | grep -qv '127\.0\.0\.1:'; then
  echo "ERROR: a container port is published outside 127.0.0.1" >&2
  exit 1
fi

step "Deploy user $DEPLOY_USER can run Docker"
# CI deploys over SSH as this user without sudo. Docker group access equals root access on this server.
usermod -aG docker "$DEPLOY_USER"
id "$DEPLOY_USER"

step "nginx and certbot"
apt-get update -q
apt-get install -y -q nginx certbot
systemctl enable --now nginx
nginx -v
certbot --version
install -d -m 755 /var/www/stub /var/www/letsencrypt
install -m 644 "$HERE/stub/index.html" /var/www/stub/index.html
install -m 644 "$HERE/nginx/acme-challenge.conf" /etc/nginx/snippets/acme-challenge.conf
install -m 644 "$HERE/nginx/ssl-$CERT_NAME.conf" "/etc/nginx/snippets/ssl-$CERT_NAME.conf"

step "Certificate for $LANDING_DOMAIN and $APP_DOMAIN"
if [ -f "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" ]; then
  echo "already issued"
else
  # The HTTPS sites need the certificate to exist, so it is issued through a temporary HTTP-only site.
  cat > /etc/nginx/sites-available/acme-bootstrap.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $LANDING_DOMAIN $APP_DOMAIN;
    include snippets/acme-challenge.conf;
}
EOF
  ln -sf /etc/nginx/sites-available/acme-bootstrap.conf /etc/nginx/sites-enabled/acme-bootstrap.conf
  nginx -t
  systemctl reload nginx
  certbot_args=(certonly --webroot -w /var/www/letsencrypt --cert-name "$CERT_NAME"
    -d "$LANDING_DOMAIN" -d "$APP_DOMAIN" -m "$EMAIL" --agree-tos --no-eff-email --non-interactive)
  # Staging run first: if validation fails, it does not count against Let's Encrypt limits.
  certbot "${certbot_args[@]}" --dry-run
  certbot "${certbot_args[@]}"
  rm /etc/nginx/sites-enabled/acme-bootstrap.conf /etc/nginx/sites-available/acme-bootstrap.conf
fi

step "Sites: stub pages, http -> https"
for site in "$LANDING_DOMAIN" "$APP_DOMAIN"; do
  install -m 644 "$HERE/nginx/$site.conf" "/etc/nginx/sites-available/$site.conf"
  ln -sf "/etc/nginx/sites-available/$site.conf" "/etc/nginx/sites-enabled/$site.conf"
done
nginx -t
systemctl reload nginx

step "Certificate renewal"
install -d /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
# Make nginx pick up a renewed certificate.
systemctl reload nginx
EOF
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl enable --now certbot.timer
systemctl list-timers certbot.timer --no-pager
certbot renew --dry-run

step "Check"
for d in "$LANDING_DOMAIN" "$APP_DOMAIN"; do
  curl -sS -o /dev/null -w "http://$d/  -> %{http_code} %{redirect_url}\n" "http://$d/"
  curl -sS -o /dev/null -w "https://$d/ -> %{http_code}\n" "https://$d/"
done
echo
echo "DONE. Log: $LOG"
