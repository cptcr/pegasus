// src/managers/OptimizedManagers.ts - Reduce Database Query Frequency
import { ExtendedClient } from '../index.js';
import { QueryOptimizer } from './QueryOptimizer.js';

export class OptimizedManagerSystem {
  private client: ExtendedClient;
  private queryOptimizer: QueryOptimizer;
  private systemIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(client: ExtendedClient) {
    this.client = client;
    this.queryOptimizer = new QueryOptimizer(client.db, client.logger);
  }

  /**
   * Initialize optimized system with reduced query frequency
   */
  async initialize(): Promise<void> {
    try {
      // Get all guild IDs the bot is in
      const guildIds = Array.from(this.client.guilds.cache.keys());
      
      // Start optimized intervals
      this.queryOptimizer.startOptimizedIntervals(guildIds);

      // Replace individual manager intervals with batch processing
      this.startBatchProcessing(guildIds);

      this.client.logger.info('🚀 Optimized manager system initialized');

    } catch (error) {
      this.client.logger.error('Failed to initialize optimized managers:', error);
    }
  }

  /**
   * Start batch processing instead of individual manager intervals
   */
  private startBatchProcessing(guildIds: string[]): void {
    // Batch process expired items every 2 minutes instead of constant checking
    const expiredItemsProcessor = setInterval(async () => {
      await this.processBatchExpiredItems(guildIds);
    }, 120000); // 2 minutes

    this.systemIntervals.set('expired_items', expiredItemsProcessor);

    // Stats update every 5 minutes instead of every 30 seconds
    const statsUpdater = setInterval(async () => {
      await this.updateGuildStats(guildIds);
    }, 300000); // 5 minutes

    this.systemIntervals.set('stats_update', statsUpdater);

    // System cleanup every 30 minutes
    const systemCleaner = setInterval(async () => {
      await this.performSystemCleanup();
    }, 1800000); // 30 minutes

    this.systemIntervals.set('system_cleanup', systemCleaner);

    this.client.logger.info('✅ Batch processing intervals started');
  }

  /**
   * Process expired items in batches
   */
  private async processBatchExpiredItems(guildIds: string[]): Promise<void> {
    try {
      let processedCount = 0;

      for (const guildId of guildIds) {
        // Check expired polls
        const expiredPolls = await this.queryOptimizer.checkExpiredPolls(guildId);
        for (const poll of expiredPolls) {
          await this.client.pollManager.endPoll(poll.id);
          processedCount++;
        }

        // Check expired giveaways
        const expiredGiveaways = await this.queryOptimizer.checkExpiredGiveaways(guildId);
        for (const giveaway of expiredGiveaways) {
          await this.client.giveawayManager.endGiveaway(giveaway.id);
          processedCount++;
        }

        // Avoid overwhelming the database - process in smaller batches
        if (processedCount >= 10) {
          break;
        }
      }

      if (processedCount > 0) {
        this.client.logger.info(`⏰ Processed ${processedCount} expired items`);
      }

    } catch (error) {
      this.client.logger.error('Batch processing error:', error);
    }
  }

  /**
   * Update guild stats less frequently
   */
  private async updateGuildStats(guildIds: string[]): Promise<void> {
    try {
      for (const guildId of guildIds) {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) continue;

        // Update stats only if there are connected dashboard clients
        const roomInfo = this.client.wsManager.getGuildRoomInfo(guildId);
        if (roomInfo.clientCount === 0) {
          continue; // Skip if no one is watching
        }

        // Fetch fresh member data only when needed
        const memberCount = guild.memberCount;
        const onlineCount = guild.presences.cache.filter(p => p.status !== 'offline').size;

        const stats = { memberCount, onlineCount };
        this.client.wsManager.emitGuildStatsUpdate(guildId, stats);
      }

    } catch (error) {
      this.client.logger.error('Stats update error:', error);
    }
  }

  /**
   * Perform system cleanup
   */
  private async performSystemCleanup(): Promise<void> {
    try {
      // Clean expired cache
      this.queryOptimizer.clearCache();

      // Get cache stats
      const cacheStats = this.queryOptimizer.getCacheStats();
      
      // Log system status
      this.client.logger.info(`🧹 System cleanup completed. Cache: ${cacheStats.size} entries (${cacheStats.memory})`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.client.logger.debug('🗑️ Garbage collection triggered');
      }

    } catch (error) {
      this.client.logger.error('System cleanup error:', error);
    }
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    cache: any;
    intervals: number;
    uptime: number;
    memory: NodeJS.MemoryUsage;
  } {
    return {
      cache: this.queryOptimizer.getCacheStats(),
      intervals: this.systemIntervals.size,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  /**
   * Shutdown optimized system
   */
  async shutdown(): Promise<void> {
    try {
      // Stop all intervals
      for (const [name, interval] of this.systemIntervals) {
        clearInterval(interval);
        this.client.logger.debug(`Stopped interval: ${name}`);
      }
      this.systemIntervals.clear();

      // Cleanup query optimizer
      this.queryOptimizer.cleanup();

      this.client.logger.info('🛑 Optimized manager system shutdown completed');

    } catch (error) {
      this.client.logger.error('Shutdown error:', error);
    }
  }
}