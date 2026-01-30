#!/usr/bin/env bash
# Signs the Tauri dev binary with microphone entitlements on macOS so that
# "npm run tauri dev" (or "cargo run" from src-tauri) gets mic access.
set -e
BINARY="$1"
shift
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENTITLEMENTS="${SCRIPT_DIR}/../src-tauri/Entitlements.plist"
if [[ -f "$ENTITLEMENTS" && -f "$BINARY" ]]; then
  codesign --force --entitlements "$ENTITLEMENTS" -s - "$BINARY" 2>/dev/null || true
fi
exec "$BINARY" "$@"
