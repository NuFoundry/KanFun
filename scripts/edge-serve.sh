#!/usr/bin/env bash
# Serves client/dist through the production deploy/Caddyfile, in front of the locally running
# stack (PocketBase and services on the ports from .env). Used by scripts/check-edge.sh through
# playwright.edge.config.ts; EDGE_PORT (default 8380) is where it listens, the website (web/dist)
# one port higher.
#
# Caddy is the version the production image uses (deploy/Dockerfile.web), downloaded once into
# node_modules/.cache and checked against deploy/.caddy-checksums.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT_DIR"
load_env

VERSION=2.11.7
CACHE="$ROOT_DIR/node_modules/.cache/caddy-$VERSION"
BIN="$CACHE/caddy"
if [ ! -x "$BIN" ]; then
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  [ "$OS" = darwin ] && OS=mac
  case "$(uname -m)" in
    x86_64 | amd64) ARCH=amd64 ;;
    arm64 | aarch64) ARCH=arm64 ;;
    *) die "Unsupported architecture: $(uname -m)" ;;
  esac
  TAR="caddy_${VERSION}_${OS}_${ARCH}.tar.gz"
  EXPECTED="$(grep " $TAR\$" deploy/.caddy-checksums | cut -d' ' -f1 || true)"
  [ -n "$EXPECTED" ] || die "No checksum for $TAR in deploy/.caddy-checksums"
  mkdir -p "$CACHE"
  log "Downloading Caddy $VERSION ($OS/$ARCH)"
  curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v$VERSION/$TAR" -o "$CACHE/$TAR"
  if command -v sha512sum >/dev/null; then ACTUAL="$(sha512sum "$CACHE/$TAR" | cut -d' ' -f1)"; else ACTUAL="$(shasum -a 512 "$CACHE/$TAR" | cut -d' ' -f1)"; fi
  [ "$ACTUAL" = "$EXPECTED" ] || die "Checksum mismatch for $TAR"
  tar -xzf "$CACHE/$TAR" -C "$CACHE" caddy
  rm "$CACHE/$TAR"
fi

[ -f client/dist/index.html ] || die "Build the client first: pnpm --filter client build"
export DOMAIN=":${EDGE_PORT:-8380}" SITE_ROOT="$ROOT_DIR/client/dist"
export PB_UPSTREAM="127.0.0.1:${PB_PORT:-8090}"
export AI_UPSTREAM="${AI_HOST:-127.0.0.1}:${AI_PORT:-8787}"
export BILLING_UPSTREAM="${BILLING_HOST:-127.0.0.1}:${BILLING_PORT:-8789}"
export PDF_UPSTREAM="${PDF_HOST:-127.0.0.1}:${PDF_PORT:-8790}"
export MCP_UPSTREAM="${MCP_HOST:-127.0.0.1}:${MCP_PORT:-8791}"
# The website's server block, on the next port (Cloudflare Pages projects simply do not use it).
[ -f web/dist/index.html ] || die "Build the website first: pnpm --filter web build"
export WEB_SITE=":${WEB_EDGE_PORT:-$((${EDGE_PORT:-8380} + 1))}" WEB_ROOT="$ROOT_DIR/web/dist"
# Caddy's own state and admin API stay out of the way of anything else on this machine.
export XDG_DATA_HOME="$CACHE/data" XDG_CONFIG_HOME="$CACHE/config" CADDY_ADMIN="127.0.0.1:0"
exec "$BIN" run --config deploy/Caddyfile --adapter caddyfile
