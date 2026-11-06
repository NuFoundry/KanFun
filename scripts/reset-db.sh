#!/usr/bin/env bash
# Wipe the local PocketBase database and re-seed it from scratch.
# Usage: pnpm db:reset   (stop `pnpm dev` first)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT_DIR"

ensure_env_file
load_env
pb_is_running && die "PocketBase is running at $POCKETBASE_URL. Stop 'pnpm dev' (or the other project using port $PB_PORT) first."

log "Removing server/pb_data"
rm -rf "$SERVER_DIR/pb_data"

ensure_pocketbase
pb_superuser_upsert

log "Seeding"
pb_start_background
trap pb_stop_background EXIT
pb_wait
run_seed
pb_stop_background
trap - EXIT

ok "Database reset and seeded."
