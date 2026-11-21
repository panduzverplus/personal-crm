#!/usr/bin/env bash
# Runs on the server, started by hand: replaces the database of the test stand with a copy of the prod
# database taken from a prod backup. Touches only the stand (project "staging"); prod is not changed.
# Usage: refresh-staging-db.sh [backup file]
#   without a file: the newest file in backups/ (for a fresh copy of prod run backup.sh first)
# Steps: stop the stand's app -> drop and recreate its database -> load the backup -> clear the login data
#   of prod (sessions and login links) -> migrations of the stand's version -> start the app -> smoke check.
# Before the first deploy to the stand there is no version yet: the script stops after loading the data,
# the first deploy applies the migrations and starts the app.
# No automatic recovery: if a step fails the script stops; run it again, the database is made from scratch.
set -euo pipefail

export DEPLOY_ENV=staging
cd "$(dirname "$0")"
# shellcheck source=lib.sh
source ./lib.sh

[ -f "$ENV_FILE" ] || { echo "ERROR: $PWD/$ENV_FILE is missing" >&2; exit 1; }
chmod 600 "$ENV_FILE"

if [ -n "${1:-}" ]; then
  FILE="$(realpath -e -- "$1" 2>/dev/null)" || { echo "ERROR: $1 does not exist" >&2; exit 1; }
else
  FILE="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
  [ -n "$FILE" ] || { echo "ERROR: no backups in $PWD/$BACKUP_DIR, run backup.sh first" >&2; exit 1; }
  FILE="$(realpath -e -- "$FILE")"
fi
[ -f "$FILE" ] || { echo "ERROR: $FILE is not a file" >&2; exit 1; }

# compose needs some app image to read compose.yaml; the database does not depend on which one.
IMAGE="$(cat "$CURRENT_IMAGE_FILE" 2>/dev/null || true)"
APP_RUNS=1
if [ -z "$IMAGE" ]; then
  APP_RUNS=""
  IMAGE="$(cat current-image 2>/dev/null || true)"
fi
[ -n "$IMAGE" ] || { echo "ERROR: no image on the server yet" >&2; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "ERROR: $IMAGE is not on the server" >&2; exit 1; }

exec 9>"deploy-$DEPLOY_ENV.lock"
flock -w 600 9 || { echo "ERROR: a $DEPLOY_ENV deploy is running, try again later" >&2; exit 1; }

step "Copy of the prod database from $FILE"
compose up -d --wait --wait-timeout 120 crm-db
compose exec -T crm-db pg_restore --list < "$FILE" >/dev/null \
  || { echo "ERROR: $FILE is not a pg_dump backup" >&2; exit 1; }

step "Stop the stand's app"
compose stop crm-app

step "Recreate an empty database of the stand"
compose exec -T crm-db sh -c \
  'dropdb -U "$POSTGRES_USER" --force --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'

step "Load the backup"
compose exec -T crm-db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --single-transaction --exit-on-error' < "$FILE"

step "Clear the login data of prod"
# Prod sessions and login links must not live on in the stand's database.
compose exec -T crm-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<'SQL'
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sessions', 'verifications', 'login_email_sends'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE %I', t);
    END IF;
  END LOOP;
END $$;
SQL

if [ -z "$APP_RUNS" ]; then
  echo
  echo "LOADED $FILE"
  echo "No version on the stand yet: the next deploy to staging applies the migrations and starts the app."
  exit 0
fi

step "Migrations of the stand's version"
compose run --rm crm-migrate

step "Start the app $IMAGE"
compose up -d --wait --wait-timeout 120 crm-app

step "Smoke check $HEALTH_URL"
smoke_check

echo
echo "REFRESHED the stand's database from $FILE"
