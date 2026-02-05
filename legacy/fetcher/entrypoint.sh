#!/bin/bash
# Entrypoint script for fetcher container
# Optimized for TypeScript/Bun runtime

set -e

echo "$(date): Fetcher container starting (TypeScript/Bun Runtime)..."

if [ ! -x "/app/scripts/run-typescript.sh" ]; then
    echo "$(date): ERROR: /app/scripts/run-typescript.sh not found or not executable"
    exit 1
fi

# Execute the TypeScript runtime script
exec /bin/bash /app/scripts/run-typescript.sh
