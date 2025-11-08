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

# Copy Prisma schema first (needed before install)
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
# Use --ignore-scripts to avoid issues with pnpm blocking Prisma scripts
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --ignore-scripts

# Generate Prisma Client manually
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

# Install production dependencies (without running postinstall yet)
# Use --ignore-scripts to prevent postinstall from running before prisma is installed
RUN pnpm install --prod --frozen-lockfile --ignore-scripts || pnpm install --prod --ignore-scripts

# Install prisma as dev dependency
RUN pnpm add -D prisma

# Now generate Prisma Client manually
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
