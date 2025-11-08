# Multi-stage build for smaller image size
# Use Debian-based Node image for better compatibility with Prisma and Railway
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL and other dependencies required by Prisma
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY tsconfig.json tsconfig.production.json ./

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile || pnpm install

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN pnpm prisma generate

# Copy source code
COPY src ./src

# Build TypeScript
RUN pnpm run build

# Production stage
# Use Debian-based Node image for better compatibility with Prisma and Railway
FROM node:20-slim

WORKDIR /app

# Install OpenSSL and other dependencies required by Prisma
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Copy Prisma schema first
COPY prisma ./prisma/

# Install production dependencies + prisma (needed for migrations and generate)
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
RUN pnpm add -D prisma

# Generate Prisma Client
RUN pnpm prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Railway will assign this dynamically)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run migrations and start server
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/server.js"]
