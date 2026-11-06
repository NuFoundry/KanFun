#!/usr/bin/env bash
# `pnpm deploy:prod`: hands off to the deploy target chosen in the setup wizard.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$DIR/fly/deploy.sh" ] && [ "${DEPLOY_TARGET:-fly}" = "fly" ]; then
  exec bash "$DIR/fly/deploy.sh" "$@"
fi
echo "No deploy target found under deploy/ (fly/ or hetzner/)." >&2
exit 1
