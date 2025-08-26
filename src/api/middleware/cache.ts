import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0
  };
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  /**
   * Get item from cache
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Expired
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    this.updateHitRate();
    return entry.data;
  }

  /**
   * Set item in cache
   */
  set(key: string, data: any, ttl: number): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    };
    
    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.stats.size = this.cache.size;
      logger.debug(`Cache cleanup: removed ${deletedCount} expired entries`);
    }
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): number {
    let deletedCount = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.stats.size = this.cache.size;
      logger.debug(`Cache invalidation: removed ${deletedCount} entries matching pattern ${pattern}`);
    }

    return deletedCount;
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton cache instance
export const cacheManager = new CacheManager();

// Cache TTL configurations
export const CacheTTL = {
  STATS: 500,          // 500ms for stats endpoints
  GUILD_DATA: 5000,    // 5 seconds for guild data
  MEMBER_LIST: 30000,  // 30 seconds for member lists
  SETTINGS: 10000,     // 10 seconds for settings
  ECONOMY: 2000,       // 2 seconds for economy data
  MODERATION: 3000,    // 3 seconds for moderation data
  TICKETS: 5000,       // 5 seconds for ticket data
  XP: 2000,           // 2 seconds for XP data
  GIVEAWAYS: 1000,    // 1 second for giveaways (real-time)
  DEFAULT: 5000       // Default 5 seconds
};

/**
 * Cache middleware factory
 */
export function cacheMiddleware(ttl?: number, keyGenerator?: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    // Generate cache key
    const cacheKey = keyGenerator ? keyGenerator(req) : `${req.method}:${req.originalUrl}`;
    
    // Try to get from cache
    const cachedData = cacheManager.get(cacheKey);
    
    if (cachedData !== null) {
      // Add cache headers
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', String(ttl || CacheTTL.DEFAULT));
      res.json(cachedData);
      return;
    }

    // Cache miss - store original send function
    const originalSend = res.json.bind(res);
    
    // Override json method to cache the response
    res.json = function(data: any): Response {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheTTL = ttl || CacheTTL.DEFAULT;
        cacheManager.set(cacheKey, data, cacheTTL);
        
        // Add cache headers
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-TTL', String(cacheTTL));
      }
      
      return originalSend(data);
    };

    next();
  };
}

/**
 * Conditional cache middleware - caches based on response
 */
export function conditionalCache(
  shouldCache: (req: Request, res: Response, data: any) => boolean,
  ttl?: number
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const cacheKey = `${req.method}:${req.originalUrl}`;
    const cachedData = cacheManager.get(cacheKey);
    
    if (cachedData !== null) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cachedData);
      return;
    }

    const originalSend = res.json.bind(res);
    
    res.json = function(data: any): Response {
      if (res.statusCode >= 200 && res.statusCode < 300 && shouldCache(req, res, data)) {
        const cacheTTL = ttl || CacheTTL.DEFAULT;
        cacheManager.set(cacheKey, data, cacheTTL);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-TTL', String(cacheTTL));
      } else {
        res.setHeader('X-Cache', 'BYPASS');
      }
      
      return originalSend(data);
    };

    next();
  };
}

/**
 * Cache invalidation middleware for mutations
 */
export function invalidateCache(pattern: string | ((req: Request) => string)) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const invalidationPattern = typeof pattern === 'function' ? pattern(req) : pattern;
    const count = cacheManager.invalidatePattern(invalidationPattern);
    
    if (count > 0) {
      logger.debug(`Invalidated ${count} cache entries for pattern: ${invalidationPattern}`);
    }
    
    next();
  };
}

/**
 * Get cache statistics endpoint middleware
 */
export function cacheStatsMiddleware(_req: Request, res: Response): void {
  const stats = cacheManager.getStats();
  res.json({
    ...stats,
    hitRate: `${stats.hitRate.toFixed(2)}%`,
    memoryUsage: process.memoryUsage().heapUsed
  });
}