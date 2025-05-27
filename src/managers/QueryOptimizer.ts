// src/managers/QueryOptimizer.ts - Reduce Database Query Spam
import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/Logger.js';

export class QueryOptimizer {
  private db: PrismaClient;
  private logger: typeof Logger;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(db: PrismaClient, logger: typeof Logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Get cached data or fetch from database
   */
  private async getCached<T>(key: string, fetcher: () => Promise<T>, ttl: number = 30000): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data;
    }

    try {
      const data = await fetcher();
      this.cache.set(key, { data, timestamp: now, ttl });
      return data;
    } catch (error) {
      this.logger.error(`Cache fetch error for ${key}:`, error);
      // Return cached data if available, even if expired
      return cached?.data || null;
    }
  }

  /**
   * Optimized poll expiration check - runs less frequently
   */
  async checkExpiredPolls(guildId: string): Promise<any[]> {
    return this.getCached(`expired_polls_${guildId}`, async () => {
      return await this.db.poll.findMany({
        where: {
          guildId,
          active: true,
          endTime: { lte: new Date() }
        },
        take: 10 // Limit results
      });
    }, 60000); // Cache for 1 minute
  }

  /**
   * Optimized giveaway expiration check
   */
  async checkExpiredGiveaways(guildId: string): Promise<any[]> {
    return this.getCached(`expired_giveaways_${guildId}`, async () => {
      return await this.db.giveaway.findMany({
        where: {
          guildId,
          active: true,
          ended: false,
          endTime: { lte: new Date() }
        },
        take: 10
      });
    }, 60000);
  }

  /**
   * Optimized quarantine check
   */
  async checkActiveQuarantines(guildId: string): Promise<any[]> {
    return this.getCached(`active_quarantines_${guildId}`, async () => {
      return await this.db.quarantine.findMany({
        where: {
          guildId,
          active: true
        },
        take: 50
      });
    }, 120000); // Cache for 2 minutes
  }

  /**
   * Batch expiration checker - reduces individual queries
   */
  async batchExpirationCheck(guildIds: string[]): Promise<void> {
    try {
      // Check all expired polls in one query
      const expiredPolls = await this.db.poll.findMany({
        where: {
          guildId: { in: guildIds },
          active: true,
          endTime: { lte: new Date() }
        }
      });

      // Check all expired giveaways in one query  
      const expiredGiveaways = await this.db.giveaway.findMany({
        where: {
          guildId: { in: guildIds },
          active: true,
          ended: false,
          endTime: { lte: new Date() }
        }
      });

      // Process expired items
      if (expiredPolls.length > 0) {
        this.logger.info(`Found ${expiredPolls.length} expired polls to process`);
      }

      if (expiredGiveaways.length > 0) {
        this.logger.info(`Found ${expiredGiveaways.length} expired giveaways to process`);
      }

    } catch (error) {
      this.logger.error('Batch expiration check failed:', error);
    }
  }

  /**
   * Start optimized interval checkers
   */
  startOptimizedIntervals(guildIds: string[]): void {
    // Clear existing intervals
    this.stopAllIntervals();

    // Batch expiration check every 2 minutes instead of every 10 seconds
    const batchInterval = setInterval(() => {
      this.batchExpirationCheck(guildIds);
    }, 120000); // 2 minutes

    this.intervals.set('batch_check', batchInterval);

    // Health check every 5 minutes
    const healthInterval = setInterval(() => {
      this.performHealthCheck();
    }, 300000); // 5 minutes

    this.intervals.set('health_check', healthInterval);

    this.logger.info('Started optimized database intervals');
  }

  /**
   * Perform system health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      
      // Log cache statistics
      const cacheSize = this.cache.size;
      const cacheKeys = Array.from(this.cache.keys());
      
      this.logger.debug(`Database health check passed. Cache entries: ${cacheSize}`);
      
      // Clean expired cache entries
      this.cleanExpiredCache();
      
    } catch (error) {
      this.logger.error('Database health check failed:', error);
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Stop all intervals
   */
  stopAllIntervals(): void {
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      this.logger.debug(`Stopped interval: ${name}`);
    }
    this.intervals.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[]; memory: string } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memory: `${Math.round(JSON.stringify([...this.cache.values()]).length / 1024)}KB`
    };
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    this.stopAllIntervals();
    this.cache.clear();
    this.logger.info('QueryOptimizer cleanup completed');
  }
}