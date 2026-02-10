#!/bin/bash
# Generate self-signed SSL certificates for local development
# Device Inventory v2

set -e

CERT_DIR="./angie/certs"
DAYS=365
SUBJECT="/C=US/ST=State/L=City/O=DeviceInventory/CN=localhost"

echo "🔐 Generating self-signed SSL certificates..."

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Generate private key and certificate
openssl req -x509 -nodes -days $DAYS -newkey rsa:2048 \
  -keyout "$CERT_DIR/localhost.key" \
  -out "$CERT_DIR/localhost.crt" \
  -subj "$SUBJECT" \
  -addext "subjectAltName=DNS:localhost,DNS:device-inventory.local,IP:127.0.0.1"

# Set proper permissions
chmod 600 "$CERT_DIR/localhost.key"
chmod 644 "$CERT_DIR/localhost.crt"

echo "✅ SSL certificates generated successfully!"
echo "   📄 Certificate: $CERT_DIR/localhost.crt"
echo "   🔑 Private Key: $CERT_DIR/localhost.key"
echo ""
echo "⚠️  Note: These are self-signed certificates for LOCAL DEVELOPMENT ONLY"
echo "   Your browser will show a security warning - this is expected."
echo ""
echo "To trust the certificate on macOS:"
echo "   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERT_DIR/localhost.crt"
