## Optimized TypeScript/Bun Fetcher Container
# Lightweight Bun runtime for modern device inventory collection
# Base image: ~150MB vs ~500MB for PowerShell

FROM oven/bun:1-alpine AS base

WORKDIR /app

# Install runtime dependencies
# curl: API ingestion calls
# ca-certificates: HTTPS/TLS support
# bash: Shell scripts for orchestration
# jq: JSON processing for API responses
# supercronic: Cron for containers
RUN apk add --no-cache \
    curl \
    ca-certificates \
    bash \
    gzip \
    findutils \
    jq \
    redis && \
    # Calculate the architecture first (x86_64 -> amd64, aarch64 -> arm64)
    ARCH="$(uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/')" && \
    # Use the variable to ensure consistency
    curl -fsSLO "https://github.com/aptible/supercronic/releases/download/v0.2.28/supercronic-linux-${ARCH}" && \
    chmod +x "supercronic-linux-${ARCH}" && \
    mv "supercronic-linux-${ARCH}" /usr/local/bin/supercronic
    
# Dependencies Stage (for caching)
# ==============================
FROM base AS dependencies

# Copy only package files for better layer caching
COPY package.json bun.lockb* ./

# Install production dependencies only
RUN bun install --production --frozen-lockfile

# ==============================
# Production Stage
# ==============================
FROM base AS production

# Copy installed dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy TypeScript source code
COPY src/ ./src/
COPY package.json ./
COPY tsconfig.json ./

# Copy TypeScript orchestration scripts
COPY scripts/ ./scripts/
COPY entrypoint.sh ./
COPY run-and-ingest.sh ./
COPY crontab ./

# Make scripts executable
RUN chmod +x /app/scripts/run-typescript.sh /app/entrypoint.sh /app/run-and-ingest.sh

# Default environment variables
# These can be overridden by docker-compose env_file or .env
ENV OUTPUT_PATH=/data/data.json \
    OUTPUT_DIR=/data \
    APP_CRASHES_OUTPUT_PATH=/data/app_crashes.json \
    CRASH_LAST_DAYS=7 \
    FETCHER_RUNTIME=typescript \
    USE_TYPESCRIPT=true \
    NODE_ENV=production \
    SCHEDULER_ENABLED=true \
    API_URL=http://api-ts:3001

# Cron schedule (default: every 30 minutes)
ENV CRON_SCHEDULE="*/30 * * * *"

# Create data directory with bun user ownership
# Note: bun user UID=1000 in oven/bun:1-alpine image
RUN mkdir -p /data /data/history /data/trends /data/logs && \
    chown -R bun:bun /data

# Shared data volume where JSON outputs are written
VOLUME ["/data"]

# Health check - verify Bun is working
HEALTHCHECK --interval=5m --timeout=10s --start-period=30s --retries=3 \
    CMD bun --version || exit 1

# Use non-root user for security
USER bun

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]

# Build metadata labels
LABEL maintainer="Device Inventory Team" \
      version="2.0" \
      runtime="typescript-bun" \
      description="TypeScript/Bun-based device inventory fetcher with Microsoft Graph API integration"
