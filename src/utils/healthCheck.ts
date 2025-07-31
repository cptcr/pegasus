import { createServer, IncomingMessage, ServerResponse } from 'http';
import { config } from '../config';
import { logger } from './logger';
import { db } from '../database/connection';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    discord: boolean;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    pool?: {
      total: number;
      idle: number;
      waiting: number;
    };
  };
  version: string;
}

export async function createHealthCheckServer(port?: number): Promise<void> {
  const actualPort = port || config.HEALTH_CHECK_PORT;
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/health' && req.method === 'GET') {
      const health = await getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health, null, 2));
    } else if (req.url === '/ready' && req.method === 'GET') {
      const isReady = await checkReadiness();
      const statusCode = isReady ? 200 : 503;
      
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: isReady }));
    } else if (req.url === '/metrics' && req.method === 'GET' && config.ENABLE_PROMETHEUS) {
      // Prometheus metrics endpoint (if enabled)
      const metrics = await getMetrics();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(metrics);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });
  
  server.listen(actualPort, () => {
    logger.info(`Health check server listening on port ${actualPort}`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    server.close(() => {
      logger.info('Health check server closed');
    });
  });
}

async function getHealthStatus(): Promise<HealthStatus> {
  const memUsage = process.memoryUsage();
  const totalMem = require('os').totalmem();
  const usedMem = memUsage.heapUsed;
  
  const checks = {
    database: await db.healthCheck(),
    discord: global.client?.isReady() ?? false,
    memory: {
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percentage: Math.round((usedMem / totalMem) * 100),
    },
    pool: await db.getPoolStats(),
  };
  
  const isHealthy = checks.database && checks.discord && checks.memory.percentage < 90;
  
  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    version: process.env.npm_package_version || '1.0.0',
  };
}

async function checkReadiness(): Promise<boolean> {
  // Check if all critical components are ready
  const dbReady = await db.healthCheck();
  const discordReady = global.client?.isReady() ?? false;
  
  return dbReady && discordReady;
}

async function getMetrics(): Promise<string> {
  const health = await getHealthStatus();
  const metrics: string[] = [];
  
  // System metrics
  metrics.push(`# HELP bot_uptime_seconds Bot uptime in seconds`);
  metrics.push(`# TYPE bot_uptime_seconds gauge`);
  metrics.push(`bot_uptime_seconds ${health.uptime}`);
  
  // Memory metrics
  metrics.push(`# HELP bot_memory_used_mb Memory used in MB`);
  metrics.push(`# TYPE bot_memory_used_mb gauge`);
  metrics.push(`bot_memory_used_mb ${health.checks.memory.used}`);
  
  metrics.push(`# HELP bot_memory_percentage Memory usage percentage`);
  metrics.push(`# TYPE bot_memory_percentage gauge`);
  metrics.push(`bot_memory_percentage ${health.checks.memory.percentage}`);
  
  // Database pool metrics
  if (health.checks.pool) {
    metrics.push(`# HELP db_pool_total Total database connections`);
    metrics.push(`# TYPE db_pool_total gauge`);
    metrics.push(`db_pool_total ${health.checks.pool.total}`);
    
    metrics.push(`# HELP db_pool_idle Idle database connections`);
    metrics.push(`# TYPE db_pool_idle gauge`);
    metrics.push(`db_pool_idle ${health.checks.pool.idle}`);
    
    metrics.push(`# HELP db_pool_waiting Waiting database connections`);
    metrics.push(`# TYPE db_pool_waiting gauge`);
    metrics.push(`db_pool_waiting ${health.checks.pool.waiting}`);
  }
  
  // Discord metrics
  if (global.client) {
    metrics.push(`# HELP discord_guilds_total Total number of guilds`);
    metrics.push(`# TYPE discord_guilds_total gauge`);
    metrics.push(`discord_guilds_total ${global.client.guilds.cache.size}`);
    
    metrics.push(`# HELP discord_users_total Total number of cached users`);
    metrics.push(`# TYPE discord_users_total gauge`);
    metrics.push(`discord_users_total ${global.client.users.cache.size}`);
    
    metrics.push(`# HELP discord_ws_ping WebSocket ping in ms`);
    metrics.push(`# TYPE discord_ws_ping gauge`);
    metrics.push(`discord_ws_ping ${global.client.ws.ping}`);
  }
  
  // Health status
  metrics.push(`# HELP bot_health_status Bot health status (1 = healthy, 0 = unhealthy)`);
  metrics.push(`# TYPE bot_health_status gauge`);
  metrics.push(`bot_health_status ${health.status === 'healthy' ? 1 : 0}`);
  
  return metrics.join('\n');
}