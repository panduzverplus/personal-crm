#!/usr/bin/env bash
# Runs on the server, started by hand: replaces the production database with a backup file.
# Usage (-t lets you answer the prompt):
#   ssh -t crm 'bash ~/personal-crm/restore.sh ~/personal-crm/backups/<file>.dump'
# Steps: show what will be replaced and wait for "yes" -> copy the current database (backup.sh before-restore)
#   -> stop the app -> drop and recreate the database -> load the backup
#   -> apply migrations of the running version -> start the same version -> smoke check.
# The app version never changes. No automatic recovery: on failure the script stops
# and prints where the copy of the replaced database is.
set -euo pipefail

FILE_ARG="${1:?usage: restore.sh <backup file>}"
FILE="$(realpath -e -- "$FILE_ARG" 2>/dev/null)" || { echo "ERROR: $FILE_ARG does not exist" >&2; exit 1; }
[ -f "$FILE" ] || { echo "ERROR: $FILE is not a file" >&2; exit 1; }
cd "$(dirname "$0")"
# shellcheck source=lib.sh
source ./lib.sh

[ -f .env ] || { echo "ERROR: $PWD/.env is missing" >&2; exit 1; }
chmod 600 .env
IMAGE="$(cat current-image 2>/dev/null || true)"
[ -n "$IMAGE" ] || { echo "ERROR: $PWD/current-image is missing, nothing is deployed yet" >&2; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 \
  || { echo "ERROR: the running version $IMAGE is not on the server" >&2; exit 1; }

step "Check the backup file"
compose up -d --wait --wait-timeout 120 crm-db
compose exec -T crm-db pg_restore --list < "$FILE" >/dev/null \
  || { echo "ERROR: $FILE is not a pg_dump backup" >&2; exit 1; }
db_name="$(compose exec -T crm-db printenv POSTGRES_DB)"
echo "OK"

cat <<EOF

Backup file:  $FILE
              $(du -h "$FILE" | cut -f1), modified $(date -r "$FILE" '+%Y-%m-%d %H:%M:%S %Z')
Database:     "$db_name" in project prod (volume prod_crm-db-data)
              it will be DROPPED and recreated from the backup file
App version:  $IMAGE
              stays the same; its migrations are applied after the restore
A copy of the current database is saved to $PWD/$BACKUP_DIR before anything is dropped.

EOF
read -r -p 'Type "yes" to replace the database: ' answer || answer=""
if [ "$answer" != yes ]; then
  echo "Cancelled, nothing changed."
  exit 1
fi

copy="$(bash ./backup.sh before-restore)"

done_ok=""
report_failure() {
  [ -n "$done_ok" ] && return
  echo >&2
  echo "ERROR: restore failed. The app may be stopped; nothing is rolled back automatically." >&2
  echo "The database before this restore is saved in $copy" >&2
}
trap report_failure EXIT

step "Stop the app"
compose stop crm-app

step "Recreate an empty database \"$db_name\""
compose exec -T crm-db sh -c \
  'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'

step "Load the backup"
compose exec -T crm-db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --single-transaction --exit-on-error' < "$FILE"

step "Migrations of the running version"
compose run --rm crm-migrate

step "Start the app $IMAGE"
compose up -d --wait --wait-timeout 120 crm-app

step "Smoke check $HEALTH_URL"
smoke_check

done_ok=1
echo
echo "RESTORED $FILE"
echo "app:     $IMAGE"
echo "copy of the replaced database: $copy"
