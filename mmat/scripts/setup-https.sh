#!/bin/bash
# Generate HTTPS certificates for local PWA development using mkcert.
# Run this once, or again if your LAN IP changes.
#
# Prerequisites: mkcert installed (brew install mkcert)
#
# Usage: ./scripts/setup-https.sh

set -e

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/.certs"

# Check mkcert is installed
if ! command -v mkcert &> /dev/null; then
  echo "Error: mkcert is not installed."
  echo "Install it with: brew install mkcert"
  exit 1
fi

# Detect LAN IP
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
if [ -z "$LAN_IP" ]; then
  echo "Warning: Could not detect LAN IP. Generating cert for localhost only."
  HOSTS="localhost 127.0.0.1"
else
  echo "Detected LAN IP: $LAN_IP"
  HOSTS="localhost 127.0.0.1 $LAN_IP"
fi

# Generate certs
mkdir -p "$CERT_DIR"
rm -f "$CERT_DIR"/*.pem

cd "$CERT_DIR"
mkcert $HOSTS

echo ""
echo "Certificates generated in $CERT_DIR"
echo ""
echo "To trust these on your phone, install the mkcert CA certificate:"
echo "  CA location: $(mkcert -CAROOT)/rootCA.pem"
echo ""
echo "  iPhone: AirDrop the rootCA.pem file to your phone, then:"
echo "    1. Settings > General > VPN & Device Management > Install the profile"
echo "    2. Settings > General > About > Certificate Trust Settings > Enable the CA"
echo ""
echo "  Android: Transfer rootCA.pem to the phone, then:"
echo "    Settings > Security > Encryption & credentials > Install a certificate > CA certificate"
