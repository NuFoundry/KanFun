#!/usr/bin/env bash
# Commit, branch and pull-request naming rules (AGENTS.md "Git and workflow"). Used by CI on every
# pull request and usable locally:
#
#   scripts/check-conventions.sh subject "feat(client): add settings page"
#   scripts/check-conventions.sh branch  "feat/settings-page"
#   scripts/check-conventions.sh commits origin/main..HEAD      # every commit subject in the range
#   scripts/check-conventions.sh pr "<title>" "<branch>" <range> # what CI runs
#   scripts/check-conventions.sh secrets                        # no keys in tracked files (pnpm check)
#
# Exit 1 with the offending line and the rule it breaks.
set -euo pipefail

TYPES="feat|fix|refactor|test|docs|chore|ci|perf|revert"
SCOPES="client|server|mailer|ai|billing|e2e|deploy|wizard|deps|release|ci"
SUBJECT_RE="^($TYPES)(\(($SCOPES)\))?!?: [a-z0-9].{0,71}$"
BRANCH_RE="^(feat|fix|refactor|test|docs|chore|ci|perf)/[a-z0-9]+(-[a-z0-9]+)*$"
# Keys that must never be committed: Stripe secret, restricted and webhook keys, AI, email, cloud
# and git tokens, OAuth client secrets, private keys.
SECRETS='(^|[^0-9A-Za-z_])((sk|rk)_(live|test)_[0-9A-Za-z]{8,}|whsec_[0-9A-Za-z]{8,}|sk-ant-[0-9A-Za-z_-]{20,}|sk-proj-[0-9A-Za-z_-]{20,}|xkeysib-[0-9a-f]{20,}|re_[0-9A-Za-z]{20,}|GOCSPX-[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[0-9A-Za-z]{20,}|xox[bap]-[0-9A-Za-z-]+|mcp_(at|rt|pat)_[0-9A-Za-z_-]{40,}|-----BEGIN [A-Z ]*PRIVATE KEY)'

fail() { printf '✖ %s\n  rule: %s\n' "$1" "$2" >&2; exit 1; }

check_subject() {
  local s="$1"
  [[ "$s" =~ $SUBJECT_RE ]] || fail "commit subject \"$s\"" \
    "<type>(<scope>)?: <subject>; type in {$TYPES}; scope in {$SCOPES}; subject starts lower-case, <= 72 chars"
  [[ "$s" != *. ]] || fail "commit subject \"$s\"" "no trailing period"
}

check_branch() {
  local b="$1"
  # Dependabot names its own branches (dependabot/github_actions/...); its PR titles still count.
  [[ "$b" == dependabot/* ]] && return 0
  [[ "$b" =~ $BRANCH_RE ]] || fail "branch \"$b\"" "<type>/<kebab-topic>, lower-case letters, digits and hyphens"
  [ "${#b}" -le 40 ] || fail "branch \"$b\"" "at most 40 characters"
}

check_commits() {
  local range="$1" subject
  while IFS= read -r subject; do
    [ -z "$subject" ] && continue
    [[ "$subject" == Merge\ * ]] && continue
    check_subject "$subject"
  done < <(git log --format=%s "$range")
}

# Tracked files as they are on disk (git grep), so a key pasted into a committed file such as
# .env.example fails `pnpm check` before the commit. Prints file and line only, never the key.
check_secrets() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  local hits
  hits="$(git grep -nIE "$SECRETS" -- . ':!pnpm-lock.yaml' | cut -d: -f1,2 || true)"
  [ -z "$hits" ] || fail "possible secret in a tracked file:
$hits" "keys belong in git-ignored env files (.env, deploy/.env.<tier>), never in committed ones"
}

case "${1:-}" in
  subject) check_subject "${2:?subject}" ;;
  branch) check_branch "${2:?branch}" ;;
  commits) check_commits "${2:?range}" ;;
  pr)
    check_subject "${2:?title}"
    check_branch "${3:?branch}"
    check_commits "${4:?range}"
    ;;
  secrets) check_secrets ;;
  *) echo "usage: $0 subject|branch|commits|pr|secrets ..." >&2; exit 2 ;;
esac
echo "✔ conventions ok"
