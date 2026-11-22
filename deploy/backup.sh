#!/usr/bin/env bash
# Runs on the server: dumps the production database (pg_dump custom format) to
#   backups/<kind>-<UTC time>-<short SHA>.dump
# where the SHA is the version running now (current-image), "none" before the first deploy.
# Usage: backup.sh [manual|deploy|daily|before-restore]   (default: manual)
#   manual          started by hand: ssh crm 'bash ~/personal-crm/backup.sh'; never deleted automatically
#   deploy          started by deploy.sh before migrations; only the newest KEEP_BACKUPS of them are kept
#   daily           started by cron through daily-backup.sh; only the newest KEEP_BACKUPS of them are kept
#   before-restore  started by restore.sh before it drops the database; never deleted automatically
# Prints the backup path as the only line on stdout; progress goes to stderr.
# Credentials come from the crm-db container environment, the script never reads .env.
set -euo pipefail

KIND="${1:-manual}"
KEEP_BACKUPS=7
case "$KIND" in
  manual | deploy | daily | before-restore) ;;
  *)
    echo "usage: backup.sh [manual|deploy|daily|before-restore]" >&2
    exit 1
    ;;
esac
cd "$(dirname "$0")"
# shellcheck source=lib.sh
source ./lib.sh

# Keep stdout for the path only.
exec 3>&1 1>&2

[ -f .env ] || { echo "ERROR: $PWD/.env is missing" >&2; exit 1; }
running="$(cat current-image 2>/dev/null || true)"
# compose needs an app image to read compose.yaml; before the first deploy deploy.sh passes the new one.
IMAGE="${IMAGE:-$running}"
[ -n "$IMAGE" ] || { echo "ERROR: nothing is deployed yet, $PWD/current-image is missing" >&2; exit 1; }

version="none"
if [ -n "$running" ]; then
  version="${running##*:}"
  version="${version:0:7}"
fi

step "Backup the database ($KIND)"
compose up -d --wait --wait-timeout 120 crm-db
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
file="$PWD/$BACKUP_DIR/$KIND-$(date -u +%Y%m%d-%H%M%S)-$version.dump"
# Write to .partial first, so an interrupted dump never looks like a finished backup.
if ! (
  umask 077
  compose exec -T crm-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file.partial"
); then
  rm -f "$file.partial"
  echo "ERROR: database backup failed" >&2
  exit 1
fi
mv "$file.partial" "$file"
echo "$file ($(du -h "$file" | cut -f1))"

# Only after a good backup exists: keep the newest KEEP_BACKUPS files of the kinds that rotate.
# Names start with the kind and the UTC time, so sorting by name is sorting by age.
# manual-* and before-restore-* are never deleted here.
if [ "$KIND" = deploy ] || [ "$KIND" = daily ]; then
  find "$BACKUP_DIR" -maxdepth 1 -name "$KIND-*.dump" | sort -r | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f --
fi
echo "$file" >&3
