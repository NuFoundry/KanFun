#!/usr/bin/env bash
# Start everything for local development in one terminal:
#   server (PocketBase), every workspace under services/, the Vite client and the website (web/).
# Ctrl+C stops all of them.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT_DIR"

ensure_env_file
load_env
[ -d node_modules ] || die "Dependencies missing. Run: pnpm bootstrap"
[ -x "$SERVER_DIR/pocketbase" ] || ensure_pocketbase

names="server"
colors="blue"
cmds=("pnpm --filter server dev")

for dir in services/*/; do
  [ -f "$dir/package.json" ] || continue
  name="$(basename "$dir")"
  names="$names,$name"
  colors="$colors,magenta"
  cmds+=("pnpm --filter ./services/$name dev")
done

names="$names,client"
colors="$colors,green"
cmds+=("pnpm --filter client dev")

# The website links to the local app instead of the production one.
if [ -f web/package.json ]; then
  names="$names,web"
  colors="$colors,yellow"
  cmds+=("PUBLIC_APP_URL=http://localhost:${CLIENT_PORT:-5173} pnpm --filter web dev")
fi

log "Starting: $names"
exec pnpm exec concurrently --kill-others --prefix-colors "$colors" --names "$names" "${cmds[@]}"
