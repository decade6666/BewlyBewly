#!/usr/bin/env bash
# gen-cert.sh - Generate a self-signed TLS certificate for linux.do
# Output stays entirely within this demo directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="$SCRIPT_DIR/certs"

mkdir -p "$CERT_DIR"

if [[ -f "$CERT_DIR/linux-do.crt" && -f "$CERT_DIR/linux-do.key" ]]; then
  echo "Certificate already exists in $CERT_DIR — skipping generation."
  echo "  cert: $CERT_DIR/linux-do.crt"
  echo "  key:  $CERT_DIR/linux-do.key"
  exit 0
fi

echo "Generating self-signed certificate for linux.do ..."

openssl req \
  -x509 \
  -newkey rsa:2048 \
  -nodes \
  -keyout "$CERT_DIR/linux-do.key" \
  -out "$CERT_DIR/linux-do.crt" \
  -days 365 \
  -subj "/CN=linux.do" \
  -addext "subjectAltName=DNS:linux.do,DNS:*.linux.do"

echo "Certificate generated:"
echo "  cert: $CERT_DIR/linux-do.crt"
echo "  key:  $CERT_DIR/linux-do.key"
