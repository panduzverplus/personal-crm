#!/usr/bin/env bash
# Runs on the GitHub Actions runner: decides which commit "Deploy prod" rolls out and checks
# that this commit has already passed the test stand.
# Usage: SHA_INPUT=<sha or empty> ci-resolve-sha.sh
#   SHA_INPUT empty   the commit of the last green "Deploy staging" run on main
#   SHA_INPUT given   that commit (full or short SHA), only if "Deploy staging" has a green run for it
# "Green run" = the whole run succeeded: image built, pushed, deployed to the stand, /health answered 200.
# Needs GH_TOKEN (actions: read) and GITHUB_REPOSITORY. Prints the full SHA and, in Actions, writes it to
# $GITHUB_OUTPUT as "sha". Prod is not touched here.
set -euo pipefail

SHA_INPUT="${SHA_INPUT:-}"
STAGING_WORKFLOW="deploy-staging.yml"
: "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}"

if [ -z "$SHA_INPUT" ]; then
  sha="$(gh run list --repo "$GITHUB_REPOSITORY" --workflow "$STAGING_WORKFLOW" --branch main \
    --status success --limit 1 --json headSha --jq '.[0].headSha // empty')"
  [ -n "$sha" ] || { echo "ERROR: no green \"Deploy staging\" run on main yet, nothing to roll out" >&2; exit 1; }
  echo "SHA field is empty: taking the last green stand deploy"
else
  [[ "$SHA_INPUT" =~ ^[0-9a-fA-F]{7,40}$ ]] || { echo "ERROR: '$SHA_INPUT' is not a commit SHA" >&2; exit 1; }
  sha="$(gh api "repos/$GITHUB_REPOSITORY/commits/$SHA_INPUT" --jq .sha)" \
    || { echo "ERROR: commit $SHA_INPUT not found in $GITHUB_REPOSITORY" >&2; exit 1; }
  passed="$(gh run list --repo "$GITHUB_REPOSITORY" --workflow "$STAGING_WORKFLOW" --commit "$sha" \
    --status success --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  [ -n "$passed" ] \
    || { echo "ERROR: commit $sha has no green \"Deploy staging\" run: it did not pass the test stand, prod is untouched" >&2; exit 1; }
  echo "Commit $sha passed the test stand (run $passed)"
fi

echo "Prod will get SHA $sha"
[ -z "${GITHUB_OUTPUT:-}" ] || echo "sha=$sha" >> "$GITHUB_OUTPUT"
echo "$sha"
