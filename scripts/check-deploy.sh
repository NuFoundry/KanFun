#!/usr/bin/env bash
# What breaks a deploy, checked before anything is deployed. The first Fly deploy of a generated
# project failed three times in a row (Dockerfile paths, a health-check shape, an app check) and
# nothing in CI had looked at the deploy files; this script does.
#
#   scripts/check-deploy.sh           configs and Dockerfiles (pnpm check)
#   scripts/check-deploy.sh --build   also build every image with Docker (CI)
#
# Always: every Dockerfile copies files that exist; every deploy/fly/*.toml names a Dockerfile
# relative to its own directory (that is how flyctl resolves it) and lists http_service checks
# as an array. When the tool is installed: `fly config validate` (needs a login), `docker compose
# config` with placeholder values, and with --build `docker build` for each image.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
BUILD=0
[ "${1:-}" = "--build" ] && BUILD=1
FAILED=0
fail() { echo "✖ $*" >&2; FAILED=1; }
ok() { echo "✔ $*"; }
skip() { echo "– $*"; }

# 1. Dockerfiles: every COPY source exists in the build context (the repo root).
dockerfiles=()
for f in server/Dockerfile services/*/Dockerfile deploy/Dockerfile.web; do
  [ -f "$f" ] && dockerfiles+=("$f")
done
for f in ${dockerfiles[@]+"${dockerfiles[@]}"}; do
  # Lines "COPY [--flags] src... dest"; a --from copy reads another stage, not the context.
  while read -r line; do
    case "$line" in *--from=*) continue ;; esac
    # shellcheck disable=SC2086
    set -- $line
    shift # COPY
    while [ $# -gt 0 ] && [ "${1#--}" != "$1" ]; do shift; done
    while [ $# -gt 1 ]; do
      [ -e "$1" ] || fail "$f copies $1, which does not exist (the build context is the repo root)"
      shift
    done
  done < <(grep -E '^[[:space:]]*COPY[[:space:]]' "$f" || true)
done
[ "$FAILED" = 0 ] && ok "Dockerfiles (${#dockerfiles[@]}) copy only files that exist"

# 2. Fly configs.
if [ -d deploy/fly ]; then
  for f in deploy/fly/*.toml; do
    dockerfile="$(sed -nE 's/^[[:space:]]*dockerfile[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$f" | head -1)"
    if [ -z "$dockerfile" ]; then
      fail "$f has no [build] dockerfile"
    elif [ ! -f "deploy/fly/$dockerfile" ]; then
      fail "$f: dockerfile \"$dockerfile\" is resolved from deploy/fly/ by flyctl and does not exist there"
    fi
    if grep -qE '^[[:space:]]*\[http_service\.checks\.' "$f"; then
      fail "$f: http_service.checks is a list in fly.toml; write [[http_service.checks]]"
    fi
  done
  [ "$FAILED" = 0 ] && ok "Fly configs name their Dockerfiles from deploy/fly/ and shape their checks"
  flyctl=""
  command -v flyctl >/dev/null && flyctl=flyctl
  command -v fly >/dev/null && flyctl=fly
  if [ -n "$flyctl" ] && "$flyctl" auth whoami >/dev/null 2>&1; then
    for f in deploy/fly/*.toml; do
      "$flyctl" config validate --config "$f" >/dev/null 2>&1 || fail "$f: fly config validate failed"
    done
    [ "$FAILED" = 0 ] && ok "fly config validate accepts every config"
  else
    skip "fly config validate skipped (flyctl not installed or not logged in)"
  fi
fi

# 3. Docker Compose: a valid file once every required value is set.
if [ -f docker-compose.yml ] && docker compose version >/dev/null 2>&1; then
  # Each `${NAME:?...}` in the file is required; give it a placeholder when the shell has none.
  for name in $(grep -oE '\$\{[A-Z_]+:\?' docker-compose.yml | tr -d '${:?' | sort -u); do
    [ -n "${!name:-}" ] || export "$name=placeholder"
  done
  if out="$(docker compose -f docker-compose.yml config -q 2>&1)"; then
    ok "docker compose config accepts docker-compose.yml"
  else
    fail "docker-compose.yml: $(echo "$out" | tail -1)"
  fi
elif [ -f docker-compose.yml ]; then
  skip "docker compose config skipped (Docker not available)"
fi

# 4. The images themselves.
if [ "$BUILD" = 1 ]; then
  docker version >/dev/null 2>&1 || { fail "--build needs Docker"; exit 1; }
  log="$(mktemp)"
  trap 'rm -f "$log"' EXIT
  for f in ${dockerfiles[@]+"${dockerfiles[@]}"}; do
    echo "▶ docker build -f $f ."
    if docker build -f "$f" -t "check-deploy-$(basename "$(dirname "$f")")" . >"$log" 2>&1; then
      ok "$f builds"
    else
      tail -40 "$log" >&2
      fail "$f does not build (the last 40 lines above)"
    fi
  done
fi

[ "$FAILED" = 0 ] || exit 1
