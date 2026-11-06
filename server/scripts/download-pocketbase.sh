#!/usr/bin/env bash
# Download the PocketBase binary pinned in server/.pocketbase-version for this OS/arch.
# Idempotent: exits early if the right version is already present.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(tr -d '[:space:]' <"$DIR/.pocketbase-version")"
SUMS="$DIR/.pocketbase-checksums"
BIN="$DIR/pocketbase"

if [ -x "$BIN" ] && "$BIN" --version 2>/dev/null | grep -q "$VERSION"; then
  echo "PocketBase $VERSION already installed"
  exit 0
fi

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$OS" in
  darwin | linux) ;;
  mingw* | msys* | cygwin*) OS=windows ;;
  *) echo "Unsupported OS: $OS" >&2; exit 1 ;;
esac
case "$ARCH" in
  x86_64 | amd64) ARCH=amd64 ;;
  arm64 | aarch64) ARCH=arm64 ;;
  armv7l) ARCH=armv7 ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

ZIP="pocketbase_${VERSION}_${OS}_${ARCH}.zip"
URL="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/${ZIP}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading PocketBase $VERSION ($OS/$ARCH)"
curl -fsSL "$URL" -o "$TMP/$ZIP"
# Checked against the release checksums committed in server/.pocketbase-checksums.
EXPECTED="$(grep " ${ZIP}\$" "$SUMS" | cut -d' ' -f1 || true)"
if [ -z "$EXPECTED" ]; then
  echo "No checksum for $ZIP in server/.pocketbase-checksums (update it with the release's checksums.txt)" >&2
  exit 1
fi
if command -v sha256sum >/dev/null; then ACTUAL="$(sha256sum "$TMP/$ZIP" | cut -d' ' -f1)"; else ACTUAL="$(shasum -a 256 "$TMP/$ZIP" | cut -d' ' -f1)"; fi
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "Checksum mismatch for $ZIP: expected $EXPECTED, got $ACTUAL" >&2
  exit 1
fi
if [ "$OS" = "windows" ]; then
  unzip -qo "$TMP/$ZIP" pocketbase.exe -d "$DIR"
else
  unzip -qo "$TMP/$ZIP" pocketbase -d "$DIR"
  chmod +x "$BIN"
fi
"$BIN" --version
