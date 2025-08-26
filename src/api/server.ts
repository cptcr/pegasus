import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { statusRouter } from './routes/status';
import { statsRouter } from './routes/stats';
import { guildsRouter } from './routes/guilds';
import { economyRouter } from './routes/economy';
import { moderationRouter } from './routes/moderation';
import { xpRouter } from './routes/xp';
import { ticketsRouter } from './routes/tickets';
import { giveawaysRouter } from './routes/giveaways';
import { settingsRouter } from './routes/settings';
import { batchRouter } from './routes/batch';
import { monitoringRouter } from './routes/monitoring';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { cacheMiddleware, cacheStatsMiddleware, CacheTTL, invalidateCache, cacheManager } from './middleware/cache';
import { ipRateLimiter, guildRateLimiter, createRateLimiter, RateLimitPresets } from './middleware/rateLimiter';
import { statsAggregator } from './services/statsAggregator';

const app = express();
const PORT = config.API_PORT || 2000;

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Cache', 'X-Cache-TTL', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
}));

app.use(express.json());

// Global rate limiting
app.use(ipRateLimiter(200, 60000)); // 200 requests per minute per IP

const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing or invalid Authorization header' 
    });
    return;
  }
  
  const token = authHeader.replace('Bearer ', '');

  if (token !== config.BOT_API_TOKEN) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid API token' 
    });
    return;
  }

  next();
};

// Health check endpoint (no auth, no cache)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cache: cacheManager.getStats(),
    aggregator: {
      running: true,
      age: statsAggregator.getStatsAge()
    }
  });
});

// Cache statistics endpoint
app.get('/cache/stats', authenticateToken, cacheStatsMiddleware);

// Protected routes with caching
app.use('/status', 
  authenticateToken, 
  cacheMiddleware(CacheTTL.STATS),
  statusRouter
);

app.use('/stats', 
  authenticateToken,
  createRateLimiter(RateLimitPresets.stats), // Match dashboard refresh rate
  cacheMiddleware(CacheTTL.STATS),
  statsRouter
);

// Batch API for optimized multi-guild fetching
app.use('/batch',
  authenticateToken,
  createRateLimiter({ windowMs: 1000, maxRequests: 5 }), // 5 batch requests per second
  batchRouter
);

// Monitoring endpoints (admin only)
app.use('/monitoring',
  authenticateToken,
  monitoringRouter
);

// Guild-specific routes with per-guild rate limiting and caching
app.use('/guilds',
  authenticateToken,
  (req, res, next) => {
    // Apply rate limiting for guild-specific routes
    if (req.params.guildId) {
      guildRateLimiter(10, 1000)(req, res, next);
    } else {
      next();
    }
  },
  guildsRouter
);

// Management API routes (mutations - invalidate cache)
app.use('/economy',
  authenticateToken,
  invalidateCache(() => `.*economy.*`),
  economyRouter
);

app.use('/moderation',
  authenticateToken,
  invalidateCache(() => `.*moderation.*`),
  moderationRouter
);

app.use('/xp',
  authenticateToken,
  invalidateCache(() => `.*xp.*`),
  xpRouter
);

app.use('/tickets',
  authenticateToken,
  invalidateCache(() => `.*tickets.*`),
  ticketsRouter
);

app.use('/giveaways',
  authenticateToken,
  invalidateCache(() => `.*giveaways.*`),
  giveawaysRouter
);

app.use('/settings',
  authenticateToken,
  invalidateCache(() => `.*settings.*`),
  settingsRouter
);

app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Not Found', 
    message: `Route ${req.path} not found` 
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('API Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message 
  });
});

export function startApiServer() {
  // Start the stats aggregator with a reasonable interval
  // 5 seconds is enough for real-time monitoring without overwhelming the system
  const statsInterval = parseInt(process.env.STATS_AGGREGATION_INTERVAL || '5000', 10);
  statsAggregator.start(statsInterval);

  const server = app.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`);
    logger.info(`API authentication enabled with Bearer token`);
    logger.info(`Caching enabled with TTLs: Stats=${CacheTTL.STATS}ms, Guild=${CacheTTL.GUILD_DATA}ms, Members=${CacheTTL.MEMBER_LIST}ms`);
    logger.info(`Rate limiting enabled: Global=200/min, Per-guild=10/sec`);
    logger.info(`Stats aggregator running with ${statsInterval}ms update interval`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing API server');
    statsAggregator.stop();
    server.close(() => {
      logger.info('API server closed');
    });
  });

  return server;
}

export { app, statsAggregator };