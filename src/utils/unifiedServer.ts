import express from 'express';
import { Client } from 'discord.js';
import { logger } from './logger';
import { db } from '../database/connection';
import { config } from '../config';
import { getNextAvailablePort } from './portFinder';
import { MonitoringDashboard } from '../monitoring/dashboard';

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

export class UnifiedServer {
  private app: express.Application;
  private port: number;
  private client: Client;
  private monitoringDashboard: MonitoringDashboard;

  constructor(client: Client, port?: number) {
    this.app = express();
    this.port = port || 3000;
    this.client = client;
    this.monitoringDashboard = new MonitoringDashboard(client, this.port);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Enable CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Health check endpoints
    this.app.get('/health', async (req, res) => {
      const health = await this.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    this.app.get('/ready', async (req, res) => {
      const isReady = await this.checkReadiness();
      const statusCode = isReady ? 200 : 503;
      res.status(statusCode).json({ ready: isReady });
    });

    if (config.ENABLE_PROMETHEUS) {
      this.app.get('/metrics', async (req, res) => {
        const metrics = await this.getMetrics();
        res.type('text/plain').send(metrics);
      });
    }

    // Add monitoring dashboard routes by delegating to MonitoringDashboard
    this.monitoringDashboard['setupRoutes'].call(this.monitoringDashboard);
    
    // Copy dashboard routes to this app
    const dashboardApp = this.monitoringDashboard['app'];
    this.app.use((req, res, next) => {
      dashboardApp(req, res, next);
    });
  }

  async start(): Promise<number> {
    // Find available port if not provided
    if (!this.port) {
      this.port = await getNextAvailablePort();
    }

    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        logger.info(`Unified server (Health Check + Monitoring) listening on port ${this.port}`);
        resolve(this.port);
      });
    });
  }

  private async getHealthStatus(): Promise<HealthStatus> {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const usedMem = memUsage.heapUsed;
    
    const checks = {
      database: await db.healthCheck(),
      discord: this.client?.isReady() ?? false,
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

  private async checkReadiness(): Promise<boolean> {
    const dbReady = await db.healthCheck();
    const discordReady = this.client?.isReady() ?? false;
    return dbReady && discordReady;
  }

  private async getMetrics(): Promise<string> {
    const health = await this.getHealthStatus();
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
    if (this.client) {
      metrics.push(`# HELP discord_guilds_total Total number of guilds`);
      metrics.push(`# TYPE discord_guilds_total gauge`);
      metrics.push(`discord_guilds_total ${this.client.guilds.cache.size}`);
      
      metrics.push(`# HELP discord_users_total Total number of cached users`);
      metrics.push(`# TYPE discord_users_total gauge`);
      metrics.push(`discord_users_total ${this.client.users.cache.size}`);
      
      metrics.push(`# HELP discord_ws_ping WebSocket ping in ms`);
      metrics.push(`# TYPE discord_ws_ping gauge`);
      metrics.push(`discord_ws_ping ${this.client.ws.ping}`);
    }
    
    // Health status
    metrics.push(`# HELP bot_health_status Bot health status (1 = healthy, 0 = unhealthy)`);
    metrics.push(`# TYPE bot_health_status gauge`);
    metrics.push(`bot_health_status ${health.status === 'healthy' ? 1 : 0}`);
    
    return metrics.join('\n');
  }

  getPort(): number {
    return this.port;
  }
}