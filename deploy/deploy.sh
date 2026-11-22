#!/usr/bin/env bash
# Runs on the server: get the image, (prod only) back up the database, apply migrations, start the new
# image, smoke-check /health. One script for both environments, the environment is the first argument.
# Usage: deploy.sh <prod|staging> <image> [--pull]
#   --pull  read a GHCR token from stdin and pull the image (used by CI)
#   without --pull the image must already be on the server: the "Deploy prod" rollback does it this way
#   (ci-deploy.sh prod --rollback), and so can you by hand:
#   bash ~/personal-crm/deploy.sh prod "$(cat ~/personal-crm/previous-image)"
# prod:    daily backup cron (install-backup-cron.sh) -> backup (backup.sh deploy) -> migrations -> new image
#          -> smoke -> clean old images.
#          The backup is named after the version that was running before this deploy:
#          backups/deploy-<UTC time>-<short SHA>.dump; backup.sh keeps only the newest 7 of them.
# staging: migrations -> new image -> smoke. No backup (the stand's database is a copy that can be made
#          again, see refresh-staging-db.sh) and no image cleanup (prod's deploy does it).
# Two deploys of one environment never run at once: the second waits for the first.
# There is no automatic rollback: any failed step stops the script with a non-zero exit code.
set -euo pipefail

export DEPLOY_ENV="${1:?usage: deploy.sh <prod|staging> <image> [--pull]}"
IMAGE="${2:?usage: deploy.sh <prod|staging> <image> [--pull]}"
PULL="${3:-}"
REPOSITORY="${IMAGE%:*}"
KEEP_IMAGE_DAYS=14
LOCK_WAIT_SECONDS=1800
cd "$(dirname "$0")"
# shellcheck source=lib.sh
source ./lib.sh

# One deploy per environment at a time. The lock is released when the script exits.
exec 9>"deploy-$DEPLOY_ENV.lock"
if ! flock -n 9; then
  echo "Another $DEPLOY_ENV deploy is running, waiting for it (up to $((LOCK_WAIT_SECONDS / 60)) minutes)"
  flock -w "$LOCK_WAIT_SECONDS" 9 || { echo "ERROR: the other $DEPLOY_ENV deploy did not finish in time" >&2; exit 1; }
fi

[ -f "$ENV_FILE" ] || { echo "ERROR: $PWD/$ENV_FILE is missing" >&2; exit 1; }
chmod 600 "$ENV_FILE"

step "Deploy to $DEPLOY_ENV: image $IMAGE"
if [ "$PULL" = "--pull" ]; then
  # A docker config of its own: the prod and the staging deploys run side by side, and a shared login
  # that one of them removes at its end would break the pull of the other.
  docker_config="$(mktemp -d)"
  trap 'rm -rf "$docker_config"' EXIT
  DOCKER_CONFIG="$docker_config" docker login ghcr.io -u "${GHCR_USER:?GHCR_USER is not set}" --password-stdin
  DOCKER_CONFIG="$docker_config" docker pull "$IMAGE"
  rm -rf "$docker_config"
elif ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "ERROR: $IMAGE is not on the server; run with --pull" >&2
  exit 1
fi

if [ "$DEPLOY_ENV" = prod ]; then
  # The daily backup (03:00 Moscow) is set up by the deploy itself: no sudo, safe to repeat. Before anything
  # is changed, so a server without cron stops the deploy here and not half-way.
  bash ./install-backup-cron.sh

  # Before migrations: if they damage data, this file holds the database as the running version left it.
  # A failed backup stops the deploy. IMAGE is passed for the very first deploy, when current-image is missing.
  IMAGE="$IMAGE" bash ./backup.sh deploy >/dev/null
fi

step "Migrations"
# Runs in a one-off container from the new image; on failure the app keeps running the old image.
compose run --rm crm-migrate

step "Start the new image"
compose up -d --wait --wait-timeout 120 crm-app

step "Smoke check $HEALTH_URL"
smoke_check

step "Remember the version"
current="$(cat "$CURRENT_IMAGE_FILE" 2>/dev/null || true)"
if [ "$current" != "$IMAGE" ]; then
  # prod keeps the version before this one for a manual rollback.
  [ -n "$current" ] && [ -n "$PREVIOUS_IMAGE_FILE" ] && echo "$current" > "$PREVIOUS_IMAGE_FILE"
  echo "$IMAGE" > "$CURRENT_IMAGE_FILE"
fi
previous=""
[ -n "$PREVIOUS_IMAGE_FILE" ] && previous="$(cat "$PREVIOUS_IMAGE_FILE" 2>/dev/null || true)"
echo "current:  $IMAGE"
echo "previous: ${previous:-none}"

if [ "$DEPLOY_ENV" = prod ]; then
  step "Remove images older than $KEEP_IMAGE_DAYS days"
  # Kept whatever their age: the two last versions of prod and the version on the stand.
  # Young images are never touched, so a stand deploy that is pulling a new image right now is safe.
  staging_image="$(cat staging-current-image 2>/dev/null || true)"
  cutoff="$(date -d "$KEEP_IMAGE_DAYS days ago" +%s)"
  docker image ls "$REPOSITORY" --format '{{.Repository}}:{{.Tag}}' \
    | { grep -vxF -e "$IMAGE" -e "${previous:-$IMAGE}" -e "${staging_image:-$IMAGE}" || true; } \
    | while read -r old; do
      created="$(docker image inspect -f '{{.Created}}' "$old")"
      if [ "$(date -d "$created" +%s)" -lt "$cutoff" ]; then
        docker image rm "$old"
      fi
    done
fi

echo
echo "DEPLOYED $DEPLOY_ENV $IMAGE"
