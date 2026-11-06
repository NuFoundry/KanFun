#!/usr/bin/env bash
# The production edge, tested: builds the client, serves it through deploy/Caddyfile in front of
# the stack, and runs e2e/edge (headers, CSP on every page, what is blocked, body limits).
# Run after changing deploy/Caddyfile, client/index.html or anything that loads from elsewhere.
#   bash scripts/check-edge.sh          (EDGE_PORT=8380 by default)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT_DIR"
log "Building the client"
pnpm --filter client build >/dev/null
log "Building the website"
pnpm --filter web build >/dev/null
log "Testing the edge (deploy/Caddyfile)"
exec pnpm exec playwright test --config playwright.edge.config.ts "$@"
