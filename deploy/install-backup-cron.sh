#!/usr/bin/env bash
# Runs on the server (deploy.sh prod calls it on every deploy): makes sure the crontab of the current user
# runs daily-backup.sh every day at 03:00 Moscow time. No sudo needed. Safe to repeat: the block is
# replaced, never duplicated, and other lines of the crontab are left as they are.
# Fails if there is no crontab command or no running cron scheduler (cron, or systemd-cron as on this server).
# The log of the runs is backup-cron.log next to the scripts.
set -euo pipefail

command -v crontab >/dev/null \
  || { echo "ERROR: there is no crontab command on the server, the daily backup cannot be set up. Run: sudo apt install cron" >&2; exit 1; }
# A classic cron daemon is cron.service (crond.service on some systems). The server runs systemd-cron instead:
# there is no daemon, crontabs become systemd timers and cron.target is the active unit.
if command -v systemctl >/dev/null \
  && ! systemctl is-active --quiet cron.service \
  && ! systemctl is-active --quiet crond.service \
  && ! systemctl is-active --quiet cron.target; then
  echo "ERROR: no cron scheduler is running (cron.service, crond.service and cron.target are all inactive), the daily backup would not start" >&2
  exit 1
fi

dir="$(cd "$(dirname "$0")" && pwd)"
marker="# personal-crm daily backup (set by install-backup-cron.sh, do not edit)"
block="$marker
CRON_TZ=Europe/Moscow
0 3 * * * cd $dir && bash daily-backup.sh >> backup-cron.log 2>&1"

current="$(crontab -l 2>/dev/null || true)"
# Drop an earlier copy of the block (and nothing else), then put the block at the end:
# CRON_TZ affects only the lines after it.
others="$(printf '%s\n' "$current" | grep -vxF -e "$marker" -e 'CRON_TZ=Europe/Moscow' | grep -v 'daily-backup\.sh' || true)"
if [ -n "$others" ]; then
  wanted="$others
$block"
else
  wanted="$block"
fi

if [ "$wanted" = "$current" ]; then
  echo "Daily backup cron: already set (03:00 Moscow time)"
else
  printf '%s\n' "$wanted" | crontab -
  echo "Daily backup cron: set (03:00 Moscow time)"
fi
