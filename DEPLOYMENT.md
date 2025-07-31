# Pegasus Bot Deployment Guide

This guide covers the comprehensive deployment process for the Pegasus Discord Bot using the enhanced production startup script.

## Table of Contents

- [Quick Start](#quick-start)
- [Production Deployment](#production-deployment)
- [Platform-Specific Deployments](#platform-specific-deployments)
- [Docker Deployment](#docker-deployment)
- [Environment Configuration](#environment-configuration)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Development Mode
```bash
# Quick development start
npm run start:dev

# With verbose logging
npm run debug:verbose

# Interactive setup (first time)
npm run setup:interactive
```

### Production Mode
```bash
# Standard production start
npm run start:prod

# Production with PM2 process manager
npm run start:prod:pm2

# Pre-flight checks only
npm run health:check
```

## Production Deployment

### Enhanced Startup Script Features

The enhanced `scripts/startup.js` provides enterprise-grade deployment capabilities:

#### Command Line Options
```bash
node scripts/startup.js [options]

Options:
  -d, --dev               Start in development mode
  -p, --prod              Start in production mode
  -m, --migrate-only      Run migrations only and exit
  -c, --check-only        Run pre-flight checks only
  -v, --verbose           Enable verbose logging
  -q, --quiet             Enable quiet mode (errors only)
  -i, --interactive       Interactive setup mode
  --skip-checks           Skip pre-flight checks (not recommended)
  --pm2                   Use PM2 for process management
  -h, --help              Show help message
```

#### Pre-flight Checks
- Node.js version validation (18+ required)
- Environment variable validation
- Database connectivity testing
- PostgreSQL version checking (13+ recommended)
- System requirements validation
- File permissions verification

#### Database Management
- Automatic database creation if not exists
- Migration execution and status verification
- Database health checks and optimization
- Connection pool testing

#### Build Process
- TypeScript compilation with error checking
- Asset copying (i18n locales, etc.)
- Build optimization and verification
- Bundle size validation

#### Production Features
- PM2 process management integration
- Health check endpoint creation
- Performance metrics collection
- Graceful error handling and recovery
- Structured logging with timestamps

### Step-by-Step Production Deployment

1. **Environment Setup**
   ```bash
   # Create production environment file
   cp .env.example .env
   
   # Edit with production values
   nano .env
   ```

2. **Pre-deployment Validation**
   ```bash
   # Run comprehensive checks
   npm run health:check
   
   # Or using startup script directly
   node scripts/startup.js --check-only --verbose
   ```

3. **Database Migration**
   ```bash
   # Run migrations in production mode
   npm run migrate:prod
   
   # Or migrate only
   node scripts/startup.js --migrate-only --prod
   ```

4. **Production Start**
   ```bash
   # Standard production deployment
   npm run start:prod
   
   # With PM2 process manager (recommended)
   npm run start:prod:pm2
   ```

## Platform-Specific Deployments

### Railway
```bash
# Deploy using deployment script
./scripts/deploy.sh --platform railway --env production

# Manual Railway deployment
railway up
```

### Heroku
```bash
# Deploy using deployment script
./scripts/deploy.sh --platform heroku --env production

# Manual Heroku deployment
git push heroku main
```

### VPS/Custom Server
```bash
# Deploy using deployment script
./scripts/deploy.sh --platform vps --env production

# Manual VPS deployment
rsync -avz --exclude node_modules . user@server:/path/to/app
ssh user@server "cd /path/to/app && npm run start:prod:pm2"
```

## Docker Deployment

### Single Container
```bash
# Build production image
docker build -t pegasus-bot:latest .

# Run with environment variables
docker run -d \
  --name pegasus-bot \
  -p 3000:3000 \
  -e BOT_TOKEN=your_token \
  -e CLIENT_ID=your_client_id \
  -e DATABASE_URL=your_db_url \
  -e NODE_ENV=production \
  -e ENABLE_MONITORING=true \
  pegasus-bot:latest
```

### Docker Compose (Recommended)
```bash
# Start full stack (bot + database)
docker-compose up -d

# Development mode
docker-compose --profile dev up

# View logs
docker-compose logs -f bot

# Scale multiple instances
docker-compose up -d --scale bot=3
```

### Container Health Checks
The Docker image includes built-in health checks:
- Health endpoint: `http://localhost:3000/health`
- Metrics endpoint: `http://localhost:3000/metrics`
- Check interval: 30 seconds

## Environment Configuration

### Required Environment Variables
```bash
# Bot Configuration
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id

# Database Configuration
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

### Recommended Environment Variables
```bash
# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
HEALTH_CHECK_PORT=3000

# Feature Flags
ENABLE_MONITORING=true
ENABLE_ANALYTICS=true

# Performance Tuning
DATABASE_MAX_CONNECTIONS=20
DATABASE_IDLE_TIMEOUT=30000
DATABASE_CONNECTION_TIMEOUT=2000

# Process Management (PM2)
PM2_INSTANCES=1  # or 'max' for all CPU cores
```

### Optional Configuration
```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=pegasus:

# API Keys
STEAM_API_KEY=your_steam_api_key
OPENAI_API_KEY=your_openai_api_key

# Monitoring
METRICS_PORT=9090
ENABLE_PROMETHEUS=false

# Webhooks
ERROR_WEBHOOK_URL=https://discord.com/api/webhooks/...
AUDIT_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Monitoring and Health Checks

### Health Check Endpoint
When `ENABLE_MONITORING=true`, the bot provides:

```bash
# Health status
curl http://localhost:3000/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-07-31T15:19:26.093Z",
  "uptime": 1234.567,
  "memory": {
    "rss": 67108864,
    "heapTotal": 29360128,
    "heapUsed": 18874144,
    "external": 1089024
  },
  "version": "1.0.0"
}
```

### Performance Metrics
```bash
# Detailed metrics
curl http://localhost:3000/metrics

# Response includes:
{
  "metrics": {
    "startTime": 1625097566093,
    "stages": {
      "preflight": { "duration": 58 },
      "database": { "duration": 1494 },
      "build": { "duration": 2341 }
    }
  },
  "system": {
    "platform": "linux",
    "arch": "x64",
    "nodeVersion": "v18.16.0",
    "cpus": 4,
    "totalMemory": 8589934592,
    "freeMemory": 2147483648
  }
}
```

### PM2 Monitoring
```bash
# Process status
pm2 status

# Real-time monitoring
pm2 monit

# View logs
pm2 logs pegasus-bot

# Restart process
pm2 restart pegasus-bot

# Graceful reload
pm2 reload pegasus-bot
```

## Troubleshooting

### Common Issues

1. **Node.js Version Error**
   ```
   Error: Node.js version v16.x.x is not supported
   Solution: Upgrade to Node.js 18+ 
   ```

2. **Database Connection Failed**
   ```
   Error: Database connection failed: ECONNREFUSED
   Solution: Check DATABASE_URL and PostgreSQL server status
   ```

3. **Missing Environment Variables**
   ```
   Error: Missing required environment variables: BOT_TOKEN
   Solution: Create .env file with required variables
   ```

4. **Build Failures**
   ```
   Error: TypeScript compilation failed
   Solution: Run 'npm run typecheck' to identify issues
   ```

5. **Permission Errors**
   ```
   Error: Cannot read /path/to/project
   Solution: Check file permissions and user access
   ```

### Debug Mode
```bash
# Verbose logging for troubleshooting
node scripts/startup.js --dev --verbose

# Skip pre-flight checks (not recommended)
node scripts/startup.js --skip-checks

# Interactive setup for configuration issues
node scripts/startup.js --interactive
```

### Log Files
When using PM2, logs are stored in:
- Error logs: `./logs/pm2-error.log`
- Output logs: `./logs/pm2-out.log`
- Combined logs: `./logs/pm2-combined.log`

### Performance Optimization

1. **Memory Management**
   - Monitor heap usage via `/metrics` endpoint
   - Set PM2 memory restart: `max_memory_restart: '1G'`
   - Use Node.js memory flags for large datasets

2. **Database Optimization**
   - Run production database optimization
   - Monitor connection pool usage
   - Use database indexes appropriately

3. **CPU Utilization**
   - Use PM2 cluster mode for multi-core systems
   - Monitor load averages in verbose logs
   - Scale horizontally for high traffic

### Recovery Procedures

1. **Automatic Recovery**
   - PM2 automatically restarts failed processes
   - Health checks detect issues early
   - Graceful shutdown handling

2. **Manual Recovery**
   ```bash
   # Restart with fresh state
   pm2 restart pegasus-bot --update-env
   
   # Full reset
   pm2 delete pegasus-bot
   npm run start:prod:pm2
   
   # Database recovery
   npm run migrate:prod
   ```

3. **Rollback Procedures**
   ```bash
   # Rollback database migrations
   npm run migrate:rollback
   
   # Revert to previous deployment
   git checkout previous-commit
   npm run start:prod:pm2
   ```

## Best Practices

1. **Security**
   - Keep environment variables secure
   - Use least-privilege principles
   - Regular security audits with `npm audit`

2. **Monitoring**
   - Set up alerting for health check failures
   - Monitor resource usage trends
   - Log analysis for issue detection

3. **Deployment**
   - Always run pre-flight checks
   - Use staging environment for testing
   - Implement blue-green deployments

4. **Maintenance**
   - Regular dependency updates
   - Monitor bot performance metrics
   - Backup database regularly

For additional support, check the GitHub issues or create a new issue with the deployment details and error logs.
DOC_END < /dev/null
