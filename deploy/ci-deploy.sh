#!/usr/bin/env bash
# Runs on the GitHub Actions runner: copies the deploy folder to the server and runs deploy.sh there.
# Usage: ci-deploy.sh <prod|staging> [--rollback]
#   without --rollback  deploys $IMAGE (pulled from GHCR with GHCR_USER / GHCR_TOKEN)
#   --rollback          prod only: deploys the version that ran before the current one. The server remembers it
#                       (previous-image) and still has the image, so there is no pull and no GHCR token.
# The version that went out is written to the run summary ($GITHUB_STEP_SUMMARY).
set -euo pipefail

ENVIRONMENT="${1:?usage: ci-deploy.sh <prod|staging> [--rollback]}"
ROLLBACK="${2:-}"
case "$ENVIRONMENT" in
  prod | staging) ;;
  *) echo "ERROR: unknown environment '$ENVIRONMENT'" >&2; exit 1 ;;
esac
case "$ROLLBACK" in
  "") ;;
  --rollback) [ "$ENVIRONMENT" = prod ] || { echo "ERROR: --rollback is for prod only" >&2; exit 1; } ;;
  *) echo "ERROR: unknown argument '$ROLLBACK'" >&2; exit 1 ;;
esac

: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_KNOWN_HOSTS:?}" "${DEPLOY_SSH_KEY:?}"
if [ -z "$ROLLBACK" ]; then
  : "${IMAGE:?}" "${GHCR_USER:?}" "${GHCR_TOKEN:?}"
fi

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
# Server-only files (.env, .env.staging, current-image, previous-image, staging-current-image, backups/, *.lock,
# backup-cron.log) are not in the repo and stay untouched.
tar -C "$here" -cf - . \
  | ssh "${ssh_opts[@]}" "$target" 'mkdir -p ~/personal-crm && tar -C ~/personal-crm --no-same-owner --no-overwrite-dir -xf -'

if [ -n "$ROLLBACK" ]; then
  IMAGE="$(ssh "${ssh_opts[@]}" "$target" 'cat ~/personal-crm/previous-image 2>/dev/null || true')"
  [ -n "$IMAGE" ] || { echo "ERROR: the server has no previous prod version (previous-image is missing)" >&2; exit 1; }
  # The value comes from a file on the server and goes into a remote command: accept only an image name.
  [[ "$IMAGE" =~ ^ghcr\.io/[a-z0-9._/-]+:[A-Za-z0-9._-]+$ ]] \
    || { echo "ERROR: previous-image holds something that is not an image name: $IMAGE" >&2; exit 1; }
  echo "Rolling prod back to $IMAGE"
  ssh "${ssh_opts[@]}" "$target" "bash ~/personal-crm/deploy.sh '$ENVIRONMENT' '$IMAGE'"
else
  printf '%s' "$GHCR_TOKEN" \
    | ssh "${ssh_opts[@]}" "$target" "GHCR_USER='$GHCR_USER' bash ~/personal-crm/deploy.sh '$ENVIRONMENT' '$IMAGE' --pull"
fi

# Reached only if deploy.sh succeeded (set -e).
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    if [ -n "$ROLLBACK" ]; then echo "### Rolled back $ENVIRONMENT"; else echo "### Deployed $ENVIRONMENT"; fi
    echo
    echo "- SHA: \`${IMAGE##*:}\`"
    echo "- Image: \`$IMAGE\`"
  } >> "$GITHUB_STEP_SUMMARY"
fi
