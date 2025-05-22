#!/bin/bash
# start.sh - Production startup script

set -e

echo "🚀 Starting Hinko Bot..."

# Load environment variables
if [ -f .env ]; then
    source .env
    echo "✅ Environment variables loaded"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Check if we're in Docker
if [ -f /.dockerenv ]; then
    echo "🐳 Running in Docker container"
    IS_DOCKER=true
else
    echo "💻 Running on host system"
    IS_DOCKER=false
fi

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
if [ "$IS_DOCKER" = true ]; then
    # In Docker, wait for postgres service
    while ! nc -z postgres 5432; do
        sleep 1
    done
else
    # On host, check if database URL is accessible
    while ! node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT 1').then(() => process.exit(0)).catch(() => process.exit(1));
    " 2>/dev/null; do
        echo "  Database not ready, waiting..."
        sleep 2
    done
fi

echo "✅ Database connection established"

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Initialize database with sample data if needed
echo "🌱 Initializing database..."
if [ "$NODE_ENV" = "development" ]; then
    npm run db:init || echo "⚠️ Database initialization skipped (already exists)"
fi

# Start the application
echo "🎯 Starting application..."
if [ "$NODE_ENV" = "production" ]; then
    # Build first in production
    if [ ! -d "dist" ] || [ ! -d "dashboard/.next" ]; then
        echo "🔨 Building application..."
        npm run build
    fi
    
    # Start both bot and dashboard
    npm start
else
    # Development mode
    npm run dev
fi