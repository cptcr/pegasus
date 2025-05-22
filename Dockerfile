# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY dashboard/package*.json ./dashboard/

# Install dependencies
RUN npm ci --only=production
RUN cd dashboard && npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/dashboard/node_modules ./dashboard/node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the bot
RUN npm run build

# Build the dashboard
RUN npm run build:dashboard

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 botuser

# Copy the built application
COPY --from=builder --chown=botuser:nodejs /app/dist ./dist
COPY --from=builder --chown=botuser:nodejs /app/dashboard/.next ./dashboard/.next
COPY --from=builder --chown=botuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=botuser:nodejs /app/dashboard/node_modules ./dashboard/node_modules
COPY --from=builder --chown=botuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=botuser:nodejs /app/package*.json ./
COPY --from=builder --chown=botuser:nodejs /app/dashboard/package*.json ./dashboard/

USER botuser

EXPOSE 3000 3001

ENV PORT 3000
ENV DASHBOARD_PORT 3001

# Start both bot and dashboard
CMD ["npm", "run", "start:all"]