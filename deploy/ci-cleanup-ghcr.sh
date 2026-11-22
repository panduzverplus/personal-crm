#!/usr/bin/env bash
# Runs on the GitHub Actions runner after a successful prod deploy: keeps the newest KEEP_BUILDS image builds
# in GHCR (ghcr.io/<owner>/<repo>) and deletes older ones.
# Usage: KEEP_SHA=<sha just deployed> ci-cleanup-ghcr.sh
#   DRY_RUN=1  only print what would be deleted
# Needs GH_TOKEN (packages: write) and GITHUB_REPOSITORY. KEEP_SHA is kept even if it is older than the newest
# builds. Only tagged versions are counted and deleted: builds are pushed without attestations
# (provenance: false), so one tag is one version and nothing live is referenced by an untagged one.
# The images on the server are cleaned by deploy.sh itself.
set -euo pipefail

KEEP_BUILDS=10
KEEP_SHA="${KEEP_SHA:-}"
DRY_RUN="${DRY_RUN:-}"
: "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}"

owner="${GITHUB_REPOSITORY%%/*}"
package="${GITHUB_REPOSITORY#*/}"
case "$(gh api "users/$owner" --jq .type)" in
  Organization) base="orgs/$owner/packages/container/$package" ;;
  *) base="users/$owner/packages/container/$package" ;;
esac

# id <TAB> created_at <TAB> tags, tagged versions only, newest first.
versions="$(gh api --paginate "$base/versions?per_page=100" \
  --jq '.[] | select((.metadata.container.tags | length) > 0) | [.id, .created_at, (.metadata.container.tags | join(","))] | @tsv' \
  | sort -t$'\t' -k2,2 -r)"

total="$(printf '%s\n' "$versions" | grep -c . || true)"
echo "GHCR $GITHUB_REPOSITORY: $total tagged versions, keeping the newest $KEEP_BUILDS${KEEP_SHA:+ and $KEEP_SHA}"

deleted=0
while IFS=$'\t' read -r id created tags; do
  [ -n "$id" ] || continue
  if [ -n "$KEEP_SHA" ] && [[ ",$tags," == *",$KEEP_SHA,"* ]]; then
    continue
  fi
  echo "delete $tags (created $created)"
  if [ -z "$DRY_RUN" ]; then
    gh api -X DELETE "$base/versions/$id" >/dev/null
  fi
  deleted=$((deleted + 1))
done < <(printf '%s\n' "$versions" | tail -n +$((KEEP_BUILDS + 1)))

echo "Deleted $deleted version(s)${DRY_RUN:+ (dry run: nothing was deleted)}"
