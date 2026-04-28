# Build stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# Builder stage
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY apps/web ./apps/web
COPY packages ./packages
WORKDIR /app/apps/web
RUN pnpm build

# Production stage
FROM node:20-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy package files
COPY --chown=nextjs:nodejs pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy built application and dependencies
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public

USER nextjs

EXPOSE 3000

ENV NEXT_TELEMETRY_DISABLED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
