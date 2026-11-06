#!/usr/bin/env bash
# Security rules a machine can check (docs/security-checklist.md has all of them, with reasons).
#
#   scripts/check-security.sh all      every tracked file (pnpm check, CI)
#   scripts/check-security.sh staged   what is about to be committed (.githooks/pre-commit), then
#                                      the checklist questions for every area the commit touches
#
# A finding prints file:line and the rule; exit 1. A line that is fine on purpose carries a comment
# with `security-allow: <reason>`, which the reviewer of the change gets to judge.
set -euo pipefail

MODE="${1:-all}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
FAILED=0

# Files to look at, and how to read one (the staged blob, or the file on disk).
if [ "$MODE" = "staged" ]; then
  FILES="$(git diff --cached --name-only --diff-filter=ACMR)"
  read_file() { git show ":$1" 2>/dev/null || true; }
elif [ "$MODE" = "all" ]; then
  FILES="$(git ls-files 2>/dev/null || true)"
  read_file() { cat "$1" 2>/dev/null || true; }
else
  echo "usage: $0 all|staged" >&2
  exit 2
fi

# Lines of the given files that match the pattern and carry no security-allow comment.
# Prints "file:line: text" (text cut to 120 characters).
grep_files() {
  local pattern="$1" file
  shift
  for file in "$@"; do
    read_file "$file" | grep -nE -- "$pattern" | grep -v 'security-allow:' |
      cut -c1-160 | sed "s#^#$file:#" || true
  done
}

rule() {
  local name="$1" hits="$2"
  [ -z "$hits" ] && return 0
  printf '✖ %s\n%s\n\n' "$name" "$(printf '%s\n' "$hits" | sed 's/^/  /')" >&2
  FAILED=1
}

pick() { printf '%s\n' "$FILES" | grep -E -- "$1" | grep -vE -- "${2:-^$}" || true; }

# Generated or vendored code is not ours to lint.
SKIP='(^|/)(node_modules|dist|coverage)/|pnpm-lock\.yaml$|^client/src/lib/pb-types\.ts$'

# 1. Keys never sit in a tracked file (also scripts/check-conventions.sh secrets).
SECRETS='(^|[^0-9A-Za-z_])((sk|rk)_(live|test)_[0-9A-Za-z]{8,}|whsec_[0-9A-Za-z]{8,}|sk-ant-[0-9A-Za-z_-]{20,}|sk-proj-[0-9A-Za-z_-]{20,}|xkeysib-[0-9a-f]{20,}|re_[0-9A-Za-z]{20,}|GOCSPX-[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[0-9A-Za-z]{20,}|xox[bap]-[0-9A-Za-z-]+|mcp_(at|rt|pat)_[0-9A-Za-z_-]{40,}|-----BEGIN [A-Z ]*PRIVATE KEY)'
FILES_ALL="$(pick '.' "$SKIP|^scripts/check-(security|conventions)\.sh$")"
# shellcheck disable=SC2086
rule "a key in a tracked file: move it to a git-ignored env file and roll it" \
  "$(grep_files "$SECRETS" $FILES_ALL | cut -d: -f1,2)"

# 2. API rules: an empty rule makes a collection public. Say why on the line (security-allow:).
MIGRATIONS="$(pick '^server/pb_migrations/.*\.js$')"
# shellcheck disable=SC2086
rule 'a public API rule ("") without a reason: scope it to the owner, or add "// security-allow: <why public>"' \
  "$(grep_files 'Rule"?[[:space:]]*[:=][[:space:]]*(""|'"''"')' $MIGRATIONS)"

# 3. Raw HTML and eval in the browser: data rendered as HTML runs on the app's origin, where the
#    session token lives. shadcn's own components (ui/) are exempt.
CLIENT="$(pick '^client/src/.*\.(ts|tsx)$' '^client/src/components/ui/|\.test\.tsx?$')"
# shellcheck disable=SC2086
rule "raw HTML or eval in the client: render text, or sanitise with a reviewed allow-list" \
  "$(grep_files 'dangerouslySetInnerHTML|\.innerHTML[[:space:]]*=|outerHTML[[:space:]]*=|insertAdjacentHTML|document\.write|[^.a-zA-Z]eval\(|new Function\(|rehype-raw' $CLIENT)"

# 4. PocketBase filters with interpolated values: a quote in the value rewrites the filter.
CODE="$(pick '^(client/src|server/seed|server/pb_hooks|services/[^/]+/src)/.*\.(ts|tsx|js)$' '\.test\.tsx?$')"
# shellcheck disable=SC2086
rule 'a PocketBase filter built from a template string: use pb.filter("x = {:x}", { x }) (hooks: params)' \
  "$(grep_files '(filter|getFirstListItem|findFirstRecordByFilter|findRecordsByFilter)[(:][[:space:]]*`[^`]*\$\{' $CODE)"

# 5. The mailer's placeholder token as a fallback: in production it would sign and send with a
#    value every buyer of the template knows. lib/internal-token.js is the one place for it.
# shellcheck disable=SC2086
rule "the placeholder MAIL_INTERNAL_TOKEN as a fallback: use server/pb_hooks/lib/internal-token.js" \
  "$(grep_files 'dev-internal-token-change-me' $(pick '^(server/pb_hooks|services/[^/]+/src)/' '/lib/internal-token\.js$|/env\.ts$|\.test\.ts$'))"

# 6. Service errors: a vendor's message (ids, account details) must not reach the browser.
SERVICES="$(pick '^services/[^/]+/src/app\.ts$')"
# shellcheck disable=SC2086
rule 'a service returns an error message from an exception: return a fixed text, log the error' \
  "$(grep_files 'c\.json\(\{[[:space:]]*error:[[:space:]]*\(?(error|err|e)( as Error\))?\.message' $SERVICES)"

# 7. Every service that accepts a body limits its size before reading it.
for file in $SERVICES; do
  content="$(read_file "$file")"
  if printf '%s' "$content" | grep -qE 'app\.(post|put|patch)\(' &&
    ! printf '%s' "$content" | grep -q 'bodyLimit'; then
    rule "a service route without a body limit (hono/body-limit)" "$file"
  fi
done

# 8. Containers run as an unprivileged user.
for file in $(pick '^services/[^/]+/Dockerfile$'); do
  read_file "$file" | grep -qE '^USER ' || rule "a service image that runs as root: add USER node" "$file"
done

# 9. CI: actions pinned to a full commit SHA, and untrusted text (titles, branch names, comments)
#    reaching a script through env, not ${{ }} inside run.
WORKFLOWS="$(pick '^\.github/workflows/.*\.ya?ml$')"
# shellcheck disable=SC2086
rule "an action not pinned to a commit SHA: uses: owner/repo@<40-hex sha> # vX.Y.Z" \
  "$(grep_files 'uses:[[:space:]]*[^.[:space:]][^@[:space:]]*@' $WORKFLOWS | grep -vE '@[0-9a-f]{40}([[:space:]]|$)' | grep -v 'docker://' || true)"
# shellcheck disable=SC2086
rule 'untrusted text interpolated into a script: pass it through env: and use "$VAR"' \
  "$(grep_files '\$\{\{[[:space:]]*github\.(event\.(pull_request|issue|comment|review|head_commit|commits|discussion|pages)|head_ref)' $WORKFLOWS | grep -vE ':[0-9]+:[[:space:]]*[A-Z_]+:[[:space:]]*\$\{\{' || true)"

# shellcheck disable=SC2086
for file in $WORKFLOWS; do
  read_file "$file" | grep -qE '^permissions:' ||
    rule "a workflow without top-level permissions: add \"permissions: { contents: read }\"" "$file"
done

# 10. The edge keeps the admin UI, the superuser API and the mailer off the internet and sends the
#     security headers (deploy/Caddyfile).
if printf '%s\n' "$FILES" | grep -qx 'deploy/Caddyfile'; then
  caddy="$(read_file deploy/Caddyfile)"
  for needle in '/api/collections/_superusers/' 'handle /mail/\*' 'Strict-Transport-Security' \
    'Content-Security-Policy' 'X-Real-IP {client_ip}' 'request_body'; do
    printf '%s' "$caddy" | grep -q -- "$needle" ||
      rule "deploy/Caddyfile lost a protection: $needle" "deploy/Caddyfile"
  done
fi

# 11. Accounts are deleted through a route that cleans up, never by the default API rule.
if [ -n "$MIGRATIONS" ]; then
  # shellcheck disable=SC2086
  rule 'users.deleteRule opened again: delete accounts through a route that cleans up' \
    "$(grep_files 'users\.deleteRule[[:space:]]*=[[:space:]]*"' $MIGRATIONS | grep -v '1757700006_security_defaults.js' || true)"
fi

if [ "$FAILED" -ne 0 ]; then
  echo "Security check failed. Fix the lines above (docs/security-checklist.md explains each rule)." >&2
  [ "$MODE" = "staged" ] && echo "Never bypass this with --no-verify." >&2
  exit 1
fi

# The questions a machine cannot answer: shown for every area this commit touches. Answer each
# for the change; fix what does not hold before committing.
if [ "$MODE" = "staged" ] && [ -n "$FILES" ]; then
  ask() {
    local pattern="$1" title="$2"
    shift 2
    printf '%s\n' "$FILES" | grep -qE -- "$pattern" || return 0
    printf '\n%s\n' "$title"
    printf '  - %s\n' "$@"
  }
  echo "Security questions for this commit (docs/security-checklist.md):"
  ask '^server/pb_migrations/' "API rules (\"Data and API rules\")" \
    "Does every rule limit the record to its owner or tenant, for list, view, create, update and delete?" \
    "Can an update move the record (owner, user, workspace) or set a field only the server may set? Guard it with @request.body.<field>:isset = false." \
    "Do relations accept only records of the same owner or tenant (a hook or a rule on the target)?" \
    "Are files that hold personal data protected (protected: true)?"
  ask '^server/pb_hooks/' "Hooks and custom routes (\"Data and API rules\", \"Abuse\")" \
    "Does a hook that reads with full rights (app.findRecordById) check the caller's ownership first?" \
    "Are fields the client must not set reset in onRecordCreateRequest / onRecordUpdateRequest?" \
    "Is a limit (plan, quota, number) counted and checked inside one transaction, safe against parallel requests?" \
    "Does a custom route require auth, check membership, and have a rate-limit rule in security.pb.js?" \
    "Does an email to an unverified address carry text the user chose? Is the mailer's status code checked?"
  ask '^services/' "Services (\"Services\")" \
    "Does every new route verify the token, limit the body, and rate-limit per user if it costs money?" \
    "Does it trust anything from the client it should not (ids of other users, prompts, prices, redirect URLs)?" \
    "Do errors reach the client as fixed text, with the detail only in the log?" \
    "Does a new secret refuse to start in production when it is missing or a placeholder?"
  ask '^client/' "Client (\"Browser\" and \"Privacy\")" \
    "Is all user or model text rendered as text (no raw HTML, Markdown without images or raw HTML)?" \
    "Do links accept only http(s) and mailto? Is every filter built with pb.filter?" \
    "Does anything new go to a third party (analytics, Sentry)? Only through track()/reportError, URLs through redactUrl, no personal data." \
    "Is anything new stored in localStorage that is not strictly needed? (Consent and the privacy policy.)"
  ask '^(deploy/|docker-compose\.yml|server/Dockerfile|services/[^/]+/Dockerfile|\.dockerignore)' "Edge and images (\"Edge and deployment\")" \
    "Does a new public path need a body limit, a 404 at the edge, or a rate limit?" \
    "Is any internal service, admin page or health detail now reachable from the internet?" \
    "Do the security headers and the CSP still hold for the change (test with scripts/check-edge.sh)?"
  ask '^(\.github/|\.gitlab-ci\.yml)' "CI (\"Supply chain\")" \
    "Is every action pinned to a SHA, are permissions minimal, and do secrets reach only the job that needs them?"
  ask '(^|/)package\.json$|^pnpm-workspace\.yaml$' "Dependencies (\"Supply chain\")" \
    "Is a new package needed at all (AGENTS.md: write less code)? Who maintains it, does it run install scripts?" \
    "Is minimumReleaseAge still in place, and is a new allowBuilds entry justified?"
  ask '(^|/)(\.env\.example|env\.ts)$|\.env\.production\.example$' "Configuration (\"Secrets\")" \
    "Is a new secret documented without a value, kept out of VITE_*, and refused in production when missing?"
  echo
fi
echo "✔ security check ok ($MODE)"
