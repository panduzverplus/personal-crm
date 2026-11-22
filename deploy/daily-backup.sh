#!/usr/bin/env bash
# Runs on the server from cron (see install-backup-cron.sh): the daily backup of the prod database.
# Waits for a running prod deploy to finish (the same lock deploy.sh holds), then runs backup.sh daily,
# which also keeps only the newest 7 daily backups. Output goes to backup-cron.log.
# Usage: daily-backup.sh   (by hand too: ssh crm 'bash ~/personal-crm/daily-backup.sh')
set -euo pipefail

LOCK_WAIT_SECONDS=1800
cd "$(dirname "$0")"

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] daily backup"
exec 9>"deploy-prod.lock"
if ! flock -n 9; then
  echo "A prod deploy is running, waiting for it (up to $((LOCK_WAIT_SECONDS / 60)) minutes)"
  flock -w "$LOCK_WAIT_SECONDS" 9 || { echo "ERROR: the prod deploy did not finish in time, no backup made" >&2; exit 1; }
fi

bash ./backup.sh daily
