# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY dashboard/package*.json ./dashboard/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd dashboard && npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Build dashboard
WORKDIR /app/dashboard
COPY --from=deps /app/dashboard/node_modules ./node_modules
RUN npm run build

# Production image, copy all the files and run the bot
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hinko

# Copy built application
COPY --from=builder --chown=hinko:nodejs /app/dist ./dist
COPY --from=builder --chown=hinko:nodejs /app/dashboard/.next ./dashboard/.next
COPY --from=builder --chown=hinko:nodejs /app/dashboard/public ./dashboard/public
COPY --from=builder --chown=hinko:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hinko:nodejs /app/dashboard/node_modules ./dashboard/node_modules
COPY --from=builder --chown=hinko:nodejs /app/prisma ./prisma
COPY --from=builder --chown=hinko:nodejs /app/package*.json ./
COPY --from=builder --chown=hinko:nodejs /app/dashboard/package*.json ./dashboard/
COPY --from=builder --chown=hinko:nodejs /app/dashboard/server.js ./dashboard/
COPY --from=builder --chown=hinko:nodejs /app/dashboard/next.config.js ./dashboard/

USER hinko

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]