# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy api app
COPY apps/api ./apps/api

# Copy shared packages
COPY packages ./packages

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build API
WORKDIR /app/apps/api
RUN pnpm build

# Generate Prisma Client
RUN pnpm prisma generate

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Install pnpm
RUN npm install -g pnpm

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Copy package files
COPY --chown=nestjs:nodejs pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy built application from builder
COPY --chown=nestjs:nodejs --from=builder /app/apps/api/dist ./dist
COPY --chown=nestjs:nodejs --from=builder /app/apps/api/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=builder /app/packages ./packages
COPY --chown=nestjs:nodejs --from=builder /app/node_modules/.bin/.prisma ./node_modules/.bin/.prisma

# Copy prisma schema for migrations
COPY --chown=nestjs:nodejs prisma ./prisma

# Switch to non-root user
USER nestjs

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
