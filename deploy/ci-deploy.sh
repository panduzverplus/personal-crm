#!/usr/bin/env bash
# Runs on the GitHub Actions runner: copies the deploy folder to the server and runs deploy.sh there.
# Usage: ci-deploy.sh <prod|staging>
set -euo pipefail

ENVIRONMENT="${1:?usage: ci-deploy.sh <prod|staging>}"
case "$ENVIRONMENT" in
  prod | staging) ;;
  *) echo "ERROR: unknown environment '$ENVIRONMENT'" >&2; exit 1 ;;
esac

: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_KNOWN_HOSTS:?}" "${DEPLOY_SSH_KEY:?}"
: "${IMAGE:?}" "${GHCR_USER:?}" "${GHCR_TOKEN:?}"

here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

(
  umask 077
  printf '%s\n' "$DEPLOY_SSH_KEY" > "$tmp/key"
  printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$tmp/known_hosts"
)
ssh_opts=(-i "$tmp/key" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$tmp/known_hosts")
target="$DEPLOY_USER@$DEPLOY_HOST"

# Copy the whole deploy/ folder, so a new script reaches the server by itself.
# Server-only files (.env, .env.staging, current-image, previous-image, staging-current-image, backups/, *.lock)
# are not in the repo and stay untouched.
tar -C "$here" -cf - . \
  | ssh "${ssh_opts[@]}" "$target" 'mkdir -p ~/personal-crm && tar -C ~/personal-crm --no-same-owner --no-overwrite-dir -xf -'
printf '%s' "$GHCR_TOKEN" \
  | ssh "${ssh_opts[@]}" "$target" "GHCR_USER='$GHCR_USER' bash ~/personal-crm/deploy.sh '$ENVIRONMENT' '$IMAGE' --pull"
