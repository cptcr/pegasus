# Multi-stage build for Discord bot with dashboard
FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY dashboard/package.json ./dashboard/
COPY prisma/ ./prisma/

# Install dependencies
RUN npm ci --only=production
RUN cd dashboard && npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Build stage for dashboard
FROM base AS dashboard-build
WORKDIR /app/dashboard
COPY dashboard/ .
RUN npm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache dumb-init

# Copy built application
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=dashboard-build /app/dashboard/.next ./dashboard/.next
COPY --from=dashboard-build /app/dashboard/public ./dashboard/public
COPY --from=dashboard-build /app/dashboard/package.json ./dashboard/
COPY --from=dashboard-build /app/dashboard/node_modules ./dashboard/node_modules

# Copy source code
COPY src/ ./src/
COPY geizhals/ ./geizhals/
COPY *.json ./
COPY *.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S hinko -u 1001
USER hinko

# Expose ports
EXPOSE 3001 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start both bot and dashboard
CMD ["dumb-init", "npm", "start"]