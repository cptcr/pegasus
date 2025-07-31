import { Collection } from 'discord.js';
import { logger } from '../utils/logger';
import { config } from '../config';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

export class RateLimiter {
  private limits: Collection<string, RateLimitEntry> = new Collection();
  private blacklist: Set<string> = new Set();
  
  // Default rate limit configurations
  private readonly configs: Map<string, RateLimitConfig> = new Map([
    ['default', { maxRequests: 5, windowMs: 60000 }],
    ['economy', { maxRequests: 3, windowMs: 60000 }],
    ['admin', { maxRequests: 10, windowMs: 60000 }],
    ['api', { maxRequests: 30, windowMs: 60000 }],
    ['heavy', { maxRequests: 1, windowMs: 300000 }], // 1 per 5 minutes
  ]);

  constructor() {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a user is rate limited
   */
  isRateLimited(
    key: string, 
    configName: string = 'default'
  ): { limited: boolean; retryAfter?: number; message?: string } {
    // Check if user is blacklisted
    if (this.blacklist.has(key)) {
      return { 
        limited: true, 
        message: 'You have been temporarily blacklisted due to excessive requests.' 
      };
    }

    const config = this.configs.get(configName) || this.configs.get('default')!;
    const now = Date.now();
    const entry = this.limits.get(key);

    // No existing entry or expired
    if (!entry || entry.resetAt <= now) {
      this.limits.set(key, {
        count: 1,
        resetAt: now + config.windowMs
      });
      return { limited: false };
    }

    // Increment counter
    entry.count++;

    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      const retryAfter = entry.resetAt - now;
      
      // Auto-blacklist if severely over limit
      if (entry.count > config.maxRequests * 3) {
        this.addToBlacklist(key, 3600000); // 1 hour
        logger.warn('User added to rate limit blacklist', { key, count: entry.count });
      }

      return {
        limited: true,
        retryAfter,
        message: config.message || `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 1000)} seconds.`
      };
    }

    return { limited: false };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Add to blacklist temporarily
   */
  addToBlacklist(key: string, duration: number): void {
    this.blacklist.add(key);
    setTimeout(() => this.blacklist.delete(key), duration);
  }

  /**
   * Remove from blacklist
   */
  removeFromBlacklist(key: string): void {
    this.blacklist.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.limits) {
      if (entry.resetAt <= now) {
        this.limits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(key: string): { count: number; resetAt: number } | null {
    const entry = this.limits.get(key);
    return entry ? { ...entry } : null;
  }

  /**
   * Configure a rate limit
   */
  configure(name: string, config: RateLimitConfig): void {
    this.configs.set(name, config);
  }

  /**
   * Create a middleware for Express/HTTP endpoints
   */
  middleware(configName: string = 'api') {
    return (req: any, res: any, next: any) => {
      const key = `api:${req.ip}`;
      const result = this.isRateLimited(key, configName);

      if (result.limited) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: result.message,
          retryAfter: result.retryAfter
        });
        return;
      }

      next();
    };
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): {
    totalEntries: number;
    blacklistedCount: number;
    topOffenders: Array<{ key: string; count: number }>;
  } {
    const topOffenders = Array.from(this.limits.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, entry]) => ({ key, count: entry.count }));

    return {
      totalEntries: this.limits.size,
      blacklistedCount: this.blacklist.size,
      topOffenders
    };
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();