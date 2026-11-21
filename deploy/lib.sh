#!/usr/bin/env bash
# Shared helpers for the deploy scripts. Source it from the deploy folder on the server;
# the caller sets IMAGE (the app image compose runs) before calling compose.
#
# The environment comes from DEPLOY_ENV: "prod" (the default, so backup.sh and restore.sh stay prod-only)
# or "staging" (the test stand). One compose.yaml serves both; everything that differs is set here.
#   prod:     compose project "prod",    settings in .env,         state files current-image, previous-image
#   staging:  compose project "staging", settings in .env.staging, state file staging-current-image

DEPLOY_ENV="${DEPLOY_ENV:-prod}"
BACKUP_DIR="backups"

case "$DEPLOY_ENV" in
  prod)
    PROJECT="prod"
    ENV_FILE=".env"
    HEALTH_URL="https://app.chigabugadaga.ru/health"
    CURRENT_IMAGE_FILE="current-image"
    PREVIOUS_IMAGE_FILE="previous-image"
    # Where nginx proxies app.chigabugadaga.ru.
    APP_PORT=3000
    # No memory limits on prod, as before.
    APP_MEM_LIMIT=0
    DB_MEM_LIMIT=0
    ;;
  staging)
    PROJECT="staging"
    ENV_FILE=".env.staging"
    # /health is the one address nginx leaves open without the password.
    HEALTH_URL="https://test-app.chigabugadaga.ru/health"
    CURRENT_IMAGE_FILE="staging-current-image"
    PREVIOUS_IMAGE_FILE=""
    # Where nginx proxies test-app.chigabugadaga.ru.
    APP_PORT=3001
    # The server has 1.8 GB of RAM and prod runs on it: the stand must not be able to take it all.
    APP_MEM_LIMIT=400m
    DB_MEM_LIMIT=192m
    ;;
  *)
    echo "ERROR: DEPLOY_ENV must be prod or staging, got '$DEPLOY_ENV'" >&2
    return 1 2>/dev/null || exit 1
    ;;
esac

step() { printf '\n=== %s ===\n' "$*"; }

compose() {
  APP_IMAGE="${IMAGE:?IMAGE is not set}" ENV_FILE="$ENV_FILE" APP_PORT="$APP_PORT" \
    APP_MEM_LIMIT="$APP_MEM_LIMIT" DB_MEM_LIMIT="$DB_MEM_LIMIT" \
    docker compose -p "$PROJECT" -f compose.yaml "$@"
}

# Waits until HEALTH_URL answers 200; fails after about a minute.
smoke_check() {
  local code=""
  for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || true)"
    [ "$code" = 200 ] && break
    sleep 2
  done
  if [ "$code" != 200 ]; then
    echo "ERROR: smoke check failed, $HEALTH_URL answered ${code:-nothing}" >&2
    return 1
  fi
  echo "$HEALTH_URL -> 200"
}
