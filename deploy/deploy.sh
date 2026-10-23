#!/usr/bin/env bash
# Runs on the server: get the image, apply migrations, start the new image, smoke-check /health.
# Usage: deploy.sh <image> [--pull]
#   --pull  read a GHCR token from stdin and pull the image (used by CI)
#   without --pull the image must already be on the server, e.g. a manual rollback:
#   bash ~/personal-crm/deploy.sh "$(cat ~/personal-crm/previous-image)"
# There is no automatic rollback: any failed step stops the script with a non-zero exit code.
set -euo pipefail

IMAGE="${1:?usage: deploy.sh <image> [--pull]}"
PULL="${2:-}"
REPOSITORY="${IMAGE%:*}"
HEALTH_URL="https://app.chigabugadaga.ru/health"
cd "$(dirname "$0")"

step() { printf '\n=== %s ===\n' "$*"; }
compose() { APP_IMAGE="$IMAGE" docker compose -p prod -f compose.yaml "$@"; }

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

step "Migrations"
# Runs in a one-off container from the new image; on failure the app keeps running the old image.
compose run --rm crm-migrate

step "Start the new image"
compose up -d --wait --wait-timeout 120 crm-app

step "Smoke check $HEALTH_URL"
code=""
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || true)"
  [ "$code" = 200 ] && break
  sleep 2
done
if [ "$code" != 200 ]; then
  echo "ERROR: smoke check failed, $HEALTH_URL answered ${code:-nothing}" >&2
  exit 1
fi
echo "$HEALTH_URL -> 200"

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

echo
echo "DEPLOYED $IMAGE"
