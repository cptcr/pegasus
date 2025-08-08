# Multi-stage build for optimal production image
FROM node:18-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies for building
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S pegasus -u 1001

# Install runtime dependencies for canvas
RUN apk add --no-cache cairo jpeg pango giflib

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application and necessary files
COPY --from=builder --chown=pegasus:nodejs /app/dist ./dist
COPY --chown=pegasus:nodejs drizzle ./drizzle
COPY --chown=pegasus:nodejs src/i18n/locales ./src/i18n/locales

# Create necessary directories
RUN mkdir -p logs && chown -R pegasus:nodejs logs

# Switch to non-root user
USER pegasus

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

# Expose port if dashboard is enabled
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/index.js"]