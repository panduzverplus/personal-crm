#!/usr/bin/env bash
# One-time, on the server, started by hand: creates ~/personal-crm/.env.staging, the settings of the test stand.
# It has its own database password, its own login secret and its own mail key; only the owner's address
# is taken from the prod .env. Nothing is printed. An existing file is never overwritten.
# Usage (the mail key is asked on the terminal, so use -t):
#   ssh -t crm 'bash ~/server-setup/create-staging-env.sh'
# The mail key: a Resend API key made for the stand only (Resend -> API Keys), not the prod one.
set -euo pipefail

DIR="$HOME/personal-crm"
TARGET="$DIR/.env.staging"
PROD_ENV="$DIR/.env"

mkdir -p "$DIR"
[ -e "$TARGET" ] && { echo "$TARGET already exists, nothing changed" >&2; exit 1; }
[ -f "$PROD_ENV" ] || { echo "ERROR: $PROD_ENV is missing" >&2; exit 1; }

owner="$(grep -E '^OWNER_EMAIL=' "$PROD_ENV" | head -n 1 | cut -d= -f2-)"
[ -n "$owner" ] || { echo "ERROR: OWNER_EMAIL is not set in $PROD_ENV" >&2; exit 1; }

read -r -s -p "Resend API key for the stand: " key
echo
[ -n "$key" ] || { echo "ERROR: the key is empty" >&2; exit 1; }

(
  umask 077
  cat > "$TARGET" <<EOF
POSTGRES_USER=crm
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=crm
OWNER_EMAIL=$owner
BETTER_AUTH_URL=https://test-app.chigabugadaga.ru
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
SMTP_URL=smtps://resend:$key@smtp.resend.com:465
EOF
)
chmod 600 "$TARGET"
echo "created $TARGET (mode 600)"
