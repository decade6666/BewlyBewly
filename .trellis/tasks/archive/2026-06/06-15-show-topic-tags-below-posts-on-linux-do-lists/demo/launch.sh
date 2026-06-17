#!/usr/bin/env bash
# launch.sh - Start the demo HTTPS server and open Chromium with the extension.
#
# Usage:
#   ./launch.sh
#
# Prerequisites:
#   - Chromium / Google Chrome on PATH
#   - Node.js >= 18
#   - Run gen-cert.sh first (this script does it automatically).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_DIR="$(realpath "$SCRIPT_DIR/../../../extension")"
USER_DATA_DIR="$SCRIPT_DIR/chromium-profile"
CERT_DIR="$SCRIPT_DIR/certs"

# --- 1. Generate certificate if needed ---
bash "$SCRIPT_DIR/gen-cert.sh"

# --- 2. Start the HTTPS server in background ---
echo "Starting HTTPS server ..."
node "$SCRIPT_DIR/server.js" &
SERVER_PID=$!
# Give the server a moment to bind.
sleep 1

# --- 3. Determine Chromium binary ---
CHROMIUM_BIN="${CHROMIUM_BIN:-}"
for candidate in chromium chromium-browser google-chrome google-chrome-stable; do
  if command -v "$candidate" &>/dev/null; then
    CHROMIUM_BIN="$candidate"
    break
  fi
done

if [[ -z "$CHROMIUM_BIN" ]]; then
  echo "ERROR: No Chromium-based browser found on PATH."
  echo "Set CHROMIUM_BIN=/path/to/chrome and retry."
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi

echo "Using browser: $CHROMIUM_BIN"
echo "Extension dir: $EXTENSION_DIR"
echo ""

# --- 4. Launch Chromium ---
# Key flags:
#   --host-resolver-rules:  map linux.do -> 127.0.0.1 (port handled by URL)
#   --ignore-certificate-errors:  accept the self-signed cert
#   --user-data-dir:  isolated profile, won't touch real browser data
#   --load-extension:  load the built extension
#   --no-first-run:  skip first-run dialogs
#   --disable-features=IsolateOrigins,SitePerProcess:  keep things simple
"$CHROMIUM_BIN" \
  --host-resolver-rules="MAP linux.do 127.0.0.1" \
  --ignore-certificate-errors \
  --user-data-dir="$USER_DATA_DIR" \
  --load-extension="$EXTENSION_DIR" \
  --no-first-run \
  "https://linux.do:8443/latest" \
  &

CHROME_PID=$!

echo ""
echo "============================================"
echo "  Demo harness launched!"
echo "  Server PID : $SERVER_PID"
echo "  Chrome PID : $CHROME_PID"
echo "  URL        : https://linux.do:8443/latest"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop the server and close Chrome."

# --- 5. Cleanup on exit ---
cleanup() {
  echo ""
  echo "Shutting down ..."
  kill "$SERVER_PID" 2>/dev/null || true
  kill "$CHROME_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  wait "$CHROME_PID" 2>/dev/null || true
  echo "Done."
}

trap cleanup EXIT INT TERM

# Wait for either process to exit.
wait -n "$SERVER_PID" "$CHROME_PID" 2>/dev/null || true
