#!/usr/bin/env bash
# Shared helpers for the deploy scripts. Source it from the deploy folder on the server;
# the caller sets IMAGE (the app image compose runs) before calling compose.

HEALTH_URL="https://app.chigabugadaga.ru/health"
BACKUP_DIR="backups"

step() { printf '\n=== %s ===\n' "$*"; }

compose() { APP_IMAGE="${IMAGE:?IMAGE is not set}" docker compose -p prod -f compose.yaml "$@"; }

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
