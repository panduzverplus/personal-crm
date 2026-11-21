#!/usr/bin/env bash
# One-time preparation of the test stand domain on the server: a password for the whole site,
# its own HTTPS certificate, the nginx site that proxies to the stand's container.
# Only adds its own files: the landing, the prod site and their certificate are not touched.
# Needs setup-server.sh to have been run before (nginx, certbot, the acme-challenge snippet).
# Usage, on the server from a copy of deploy/server (the password is asked on the terminal, so use -t):
#   ssh -t crm 'sudo bash ~/server-setup/setup-staging.sh <letsencrypt-email>'
# Safe to re-run: an existing password file and certificate are kept.
set -euo pipefail

EMAIL="${1:?usage: sudo bash setup-staging.sh <letsencrypt-email>}"
DOMAIN="test-app.chigabugadaga.ru"
HTPASSWD=/etc/nginx/test-app.htpasswd
LOGIN="staging"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo" >&2; exit 1; }
trap 'echo "FAILED at line $LINENO" >&2' ERR
step() { printf '\n=== %s ===\n' "$*"; }

[ -f /etc/nginx/snippets/acme-challenge.conf ] \
  || { echo "ERROR: run setup-server.sh first (no acme-challenge snippet)" >&2; exit 1; }

step "Password for $DOMAIN (login: $LOGIN)"
if [ -f "$HTPASSWD" ]; then
  echo "$HTPASSWD already exists, kept. To change the password delete it and run this script again."
else
  read -r -s -p "Choose a password for the test stand: " password
  echo
  read -r -s -p "Repeat it: " again
  echo
  [ -n "$password" ] || { echo "ERROR: the password is empty" >&2; exit 1; }
  [ "$password" = "$again" ] || { echo "ERROR: the passwords differ" >&2; exit 1; }
  # Only a hash goes to the file; the password itself is written nowhere.
  (umask 027; printf '%s:%s\n' "$LOGIN" "$(printf '%s' "$password" | openssl passwd -apr1 -stdin)" > "$HTPASSWD")
  chown root:www-data "$HTPASSWD"
  chmod 640 "$HTPASSWD"
  unset password again
  echo "saved $HTPASSWD"
fi

step "Certificate for $DOMAIN"
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "already issued"
else
  # The HTTPS site needs the certificate to exist, so it is issued through a temporary HTTP-only site.
  cat > /etc/nginx/sites-available/acme-bootstrap-staging.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    include snippets/acme-challenge.conf;
}
EOF
  ln -sf /etc/nginx/sites-available/acme-bootstrap-staging.conf /etc/nginx/sites-enabled/acme-bootstrap-staging.conf
  nginx -t
  systemctl reload nginx
  certbot_args=(certonly --webroot -w /var/www/letsencrypt --cert-name "$DOMAIN"
    -d "$DOMAIN" -m "$EMAIL" --agree-tos --no-eff-email --non-interactive)
  # Staging run first: if validation fails, it does not count against Let's Encrypt limits.
  certbot "${certbot_args[@]}" --dry-run
  certbot "${certbot_args[@]}"
  rm /etc/nginx/sites-enabled/acme-bootstrap-staging.conf /etc/nginx/sites-available/acme-bootstrap-staging.conf
fi

step "Site $DOMAIN"
install -m 644 "$HERE/nginx/$DOMAIN.conf" "/etc/nginx/sites-available/$DOMAIN.conf"
ln -sf "/etc/nginx/sites-available/$DOMAIN.conf" "/etc/nginx/sites-enabled/$DOMAIN.conf"
nginx -t
systemctl reload nginx

step "Check"
# 401 without the password: the site is closed. /health is open: 502 is normal until the first deploy.
curl -sS -o /dev/null -w "http://$DOMAIN/        -> %{http_code} %{redirect_url}\n" "http://$DOMAIN/"
curl -sS -o /dev/null -w "https://$DOMAIN/       -> %{http_code} (401 = closed by the password)\n" "https://$DOMAIN/"
curl -sS -o /dev/null -w "https://$DOMAIN/health -> %{http_code} (200 after the first deploy)\n" "https://$DOMAIN/health"
echo
echo "DONE"
