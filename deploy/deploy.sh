#!/usr/bin/env bash
# Runs on the server: get the image, back up the database, apply migrations, start the new image,
# smoke-check /health.
# Usage: deploy.sh <image> [--pull]
#   --pull  read a GHCR token from stdin and pull the image (used by CI)
#   without --pull the image must already be on the server, e.g. a manual rollback:
#   bash ~/personal-crm/deploy.sh "$(cat ~/personal-crm/previous-image)"
# The backup (backup.sh deploy) is named after the version that was running before this deploy:
#   backups/deploy-<UTC time>-<short SHA>.dump; only the newest KEEP_BACKUPS of them are kept.
# There is no automatic rollback: any failed step stops the script with a non-zero exit code.
set -euo pipefail

IMAGE="${1:?usage: deploy.sh <image> [--pull]}"
PULL="${2:-}"
REPOSITORY="${IMAGE%:*}"
KEEP_BACKUPS=10
cd "$(dirname "$0")"
# shellcheck source=lib.sh
source ./lib.sh

[ -f .env ] || { echo "ERROR: $PWD/.env is missing" >&2; exit 1; }
chmod 600 .env

step "Image $IMAGE"
if [ "$PULL" = "--pull" ]; then
  trap 'docker logout ghcr.io >/dev/null' EXIT
  docker login ghcr.io -u "${GHCR_USER:?GHCR_USER is not set}" --password-stdin
  docker pull "$IMAGE"
elif ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "ERROR: $IMAGE is not on the server; run with --pull" >&2
  exit 1
fi

# Before migrations: if they damage data, this file holds the database as the running version left it.
# A failed backup stops the deploy. IMAGE is passed for the very first deploy, when current-image is missing.
IMAGE="$IMAGE" bash ./backup.sh deploy >/dev/null

step "Migrations"
# Runs in a one-off container from the new image; on failure the app keeps running the old image.
compose run --rm crm-migrate

step "Start the new image"
compose up -d --wait --wait-timeout 120 crm-app

step "Smoke check $HEALTH_URL"
smoke_check

step "Keep only the current and the previous image"
current="$(cat current-image 2>/dev/null || true)"
if [ "$current" != "$IMAGE" ]; then
  [ -n "$current" ] && echo "$current" > previous-image
  echo "$IMAGE" > current-image
fi
previous="$(cat previous-image 2>/dev/null || true)"
docker image ls "$REPOSITORY" --format '{{.Repository}}:{{.Tag}}' \
  | { grep -vxF -e "$IMAGE" -e "${previous:-$IMAGE}" || true; } \
  | xargs -r docker image rm
echo "current:  $IMAGE"
echo "previous: ${previous:-none}"

step "Keep only the newest $KEEP_BACKUPS deploy backups"
# Names start with the UTC time, so sorting by name is sorting by age.
# Manual backups (manual-*.dump) and copies made by restore.sh (before-restore-*.dump) are never deleted here.
find "$BACKUP_DIR" -maxdepth 1 -name 'deploy-*.dump' | sort -r | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f --
ls -1 "$BACKUP_DIR"

echo
echo "DEPLOYED $IMAGE"
