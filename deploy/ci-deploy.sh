#!/usr/bin/env bash
# Runs on the GitHub Actions runner: copies the deploy files to the server and runs deploy.sh there.
set -euo pipefail

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

ssh "${ssh_opts[@]}" "$target" 'mkdir -p ~/personal-crm'
scp "${ssh_opts[@]}" "$here/compose.yaml" "$here/deploy.sh" "$target:personal-crm/"
printf '%s' "$GHCR_TOKEN" \
  | ssh "${ssh_opts[@]}" "$target" "GHCR_USER='$GHCR_USER' bash ~/personal-crm/deploy.sh '$IMAGE' --pull"
