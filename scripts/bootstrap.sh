#!/usr/bin/env bash
# One-shot project setup: toolchain check, deps, PocketBase binary, superuser, seed, browsers.
# Usage: pnpm bootstrap          (env: SKIP_SEED=1, SKIP_BROWSERS=1, SKIP_TYPEGEN=1)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT_DIR"

log "Checking toolchain"
command -v node >/dev/null || die "Node.js 22+ is required (see .nvmrc)"
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
[ "$NODE_MAJOR" -ge 24 ] || die "Node 24+ required, found $(node -v). Run: nvm use"
if ! command -v pnpm >/dev/null; then
  warn "pnpm not found, enabling it through corepack"
  corepack enable && corepack prepare pnpm@latest --activate
fi
command -v curl >/dev/null || die "curl is required"
command -v unzip >/dev/null || die "unzip is required"
ok "node $(node -v), pnpm $(pnpm -v)"

ensure_env_file
load_env

log "Installing dependencies"
pnpm install

# The pre-commit security check (.githooks/pre-commit); `pnpm install` sets it too.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git config core.hooksPath .githooks

log "Downloading PocketBase"
ensure_pocketbase
pb_superuser_upsert

if [ "${SKIP_SEED:-0}" != "1" ]; then
  if pb_is_running; then
    pb_assert_ours
    log "PocketBase already running, seeding against it"
    run_seed
  else
    log "Seeding database"
    pb_start_background
    trap pb_stop_background EXIT
    pb_wait
    run_seed
    pb_stop_background
    trap - EXIT
  fi
fi

if [ "${SKIP_TYPEGEN:-0}" != "1" ] && [ -f "$SERVER_DIR/pb_data/data.db" ]; then
  log "Regenerating client/src/lib/pb-types.ts from the schema"
  (cd "$ROOT_DIR" && pnpm typegen >/dev/null)
fi

if [ "${SKIP_BROWSERS:-0}" != "1" ]; then
  log "Installing Playwright Chromium (SKIP_BROWSERS=1 to skip)"
  pnpm exec playwright install chromium
fi

ok "Bootstrap complete."
echo
echo "  pnpm dev          start PocketBase, services and the client"
echo "  pnpm test         unit tests (jest)"
echo "  pnpm test:e2e     end-to-end tests (playwright)"
echo "  Admin UI          $POCKETBASE_URL/_/  ($PB_ADMIN_EMAIL)"
echo
