# API-TS Dockerfile (Bun Runtime)
FROM oven/bun:1-alpine AS base

WORKDIR /app

# Install dependencies first (for caching)
COPY package.json bun.lock ./
# Install all dependencies (including devDeps) for development support
RUN bun install --frozen-lockfile

# Copy source code and updated package.json
COPY package.json bun.lock ./
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./

# Create .certs directory with proper permissions for certificate storage
RUN mkdir -p /app/.certs && chown -R bun:bun /app/.certs

# Fix ownership for bun user
RUN chown -R bun:bun /app

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:3001/health").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Use non-root user for security
USER bun

# Start server
CMD ["bun", "run", "src/index.ts"]
