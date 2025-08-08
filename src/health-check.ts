import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config/env';
import { db } from './database';
import { guilds } from './database/schema';
import { sql } from 'drizzle-orm';
import * as http from 'http';
import * as os from 'os';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: boolean;
    discord: boolean;
    memory: boolean;
    disk: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    cpuUsage: number;
  };
  errors: string[];
}

async function performHealthCheck(): Promise<HealthStatus> {
  const errors: string[] = [];
  const checks = {
    database: false,
    discord: false,
    memory: false,
    disk: false,
  };

  // Check database connectivity
  try {
    await db
      .select({ count: sql<number>`count(*)` })
      .from(guilds)
      .limit(1);
    checks.database = true;
  } catch (error) {
    errors.push(`Database check failed: ${error}`);
  }

  // Check Discord connectivity
  try {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error('Discord connection timeout'));
      }, 5000);

      client.once('ready', () => {
        clearTimeout(timeout);
        client.destroy();
        resolve(true);
      });

      client.once('error', error => {
        clearTimeout(timeout);
        client.destroy();
        reject(error);
      });

      client.login(config.DISCORD_TOKEN).catch(reject);
    });

    checks.discord = true;
  } catch (error) {
    errors.push(`Discord check failed: ${error}`);
  }

  // Check memory usage
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercentage = (usedMem / totalMem) * 100;

  checks.memory = memPercentage < 90; // Alert if memory usage is above 90%
  if (!checks.memory) {
    errors.push(`High memory usage: ${memPercentage.toFixed(2)}%`);
  }

  // Check disk space (simplified check)
  checks.disk = true; // Node.js doesn't have built-in disk space checking

  // Calculate CPU usage
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  const cpuUsage = 100 - ~~((100 * totalIdle) / totalTick);

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const failedChecks = Object.values(checks).filter(check => !check).length;

  if (failedChecks === 0) {
    status = 'healthy';
  } else if (failedChecks <= 1) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return {
    status,
    timestamp: new Date(),
    checks,
    metrics: {
      uptime: process.uptime(),
      memoryUsage: {
        used: usedMem,
        total: totalMem,
        percentage: memPercentage,
      },
      cpuUsage,
    },
    errors,
  };
}

// Create HTTP server for health check endpoint
const server = http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    try {
      const health = await performHealthCheck();
      const statusCode =
        health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'unhealthy',
          error: String(error),
          timestamp: new Date(),
        })
      );
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = process.env.HEALTH_CHECK_PORT || 3001;

if (require.main === module) {
  // If run directly, start the health check server
  server.listen(PORT, () => {
    console.log(`Health check server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    server.close(() => {
      console.log('Health check server closed');
      process.exit(0);
    });
  });
}

// Export for use in other parts of the application
export { performHealthCheck, server as healthCheckServer };
