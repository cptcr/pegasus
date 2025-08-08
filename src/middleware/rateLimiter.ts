import { Collection } from 'discord.js';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

// ===========================
// RATE LIMITER CONFIGURATION
// ===========================

export interface RateLimitConfig {
  points: number;          // Number of requests allowed
  duration: number;        // Time window in seconds
  blockDuration?: number;  // Block duration if limit exceeded (seconds)
  execEvenly?: boolean;    // Spread requests evenly
  keyPrefix?: string;      // Prefix for rate limit keys
}

export interface RateLimitResult {
  allowed: boolean;
  remainingPoints: number;
  msBeforeNext: number;
  consumedPoints: number;
  isBlocked: boolean;
  totalHits?: number;
}

// Rate limit configurations per command category
export const RateLimitPresets = {
  // Strict limits for sensitive operations
  moderation: {
    points: 5,
    duration: 60,
    blockDuration: 300,
  },
  
  // Economy commands need throttling to prevent abuse
  economy: {
    points: 3,
    duration: 10,
    blockDuration: 60,
  },
  
  // Gambling has stricter limits
  gambling: {
    points: 2,
    duration: 5,
    blockDuration: 120,
  },
  
  // Rob command has special limits
  rob: {
    points: 1,
    duration: 86400, // Once per day
    blockDuration: 0,
  },
  
  // Daily rewards
  daily: {
    points: 1,
    duration: 86400,
    blockDuration: 0,
  },
  
  // General commands
  general: {
    points: 10,
    duration: 60,
    blockDuration: 0,
  },
  
  // Utility commands
  utility: {
    points: 20,
    duration: 60,
    blockDuration: 0,
  },
  
  // Config commands
  config: {
    points: 5,
    duration: 60,
    blockDuration: 120,
  },
  
  // XP commands
  xp: {
    points: 10,
    duration: 30,
    blockDuration: 0,
  },
  
  // Ticket operations
  ticket: {
    points: 3,
    duration: 60,
    blockDuration: 300,
  },
  
  // API-heavy operations
  api: {
    points: 5,
    duration: 60,
    blockDuration: 120,
  },
  
  // Message processing
  message: {
    points: 30,
    duration: 60,
    blockDuration: 0,
  },
  
  // Voice state updates
  voice: {
    points: 20,
    duration: 60,
    blockDuration: 0,
  },
  
  // Global rate limit (per user)
  global: {
    points: 50,
    duration: 60,
    blockDuration: 600,
  },
  
  // Guild-wide rate limit
  guild: {
    points: 200,
    duration: 60,
    blockDuration: 300,
  },
};

// ===========================
// ENHANCED RATE LIMITER CLASS
// ===========================

export class EnhancedRateLimiter {
  private limits: Collection<string, RateLimitBucket>;
  private blocked: Collection<string, number>;
  private warnings: Collection<string, number>;
  
  constructor() {
    this.limits = new Collection();
    this.blocked = new Collection();
    this.warnings = new Collection();
    
    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }
  
  /**
   * Check and consume rate limit points
   */
  async consume(
    key: string,
    config: RateLimitConfig = RateLimitPresets.general
  ): Promise<RateLimitResult> {
    const hashedKey = this.hashKey(key);
    const fullKey = `${config.keyPrefix || 'rl'}:${hashedKey}`;
    
    // Check if blocked
    const blockExpiry = this.blocked.get(fullKey);
    if (blockExpiry && blockExpiry > Date.now()) {
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: blockExpiry - Date.now(),
        consumedPoints: config.points,
        isBlocked: true,
      };
    }
    
    // Get or create bucket
    let bucket = this.limits.get(fullKey);
    if (!bucket) {
      bucket = new RateLimitBucket(config);
      this.limits.set(fullKey, bucket);
    }
    
    // Try to consume points
    const result = bucket.consume();
    
    // Handle blocking if limit exceeded
    if (!result.allowed && config.blockDuration) {
      const blockUntil = Date.now() + (config.blockDuration * 1000);
      this.blocked.set(fullKey, blockUntil);
      
      // Track warnings
      const warningKey = `warn:${hashedKey}`;
      const warnings = (this.warnings.get(warningKey) || 0) + 1;
      this.warnings.set(warningKey, warnings);
      
      // Log security event
      if (warnings >= 3) {
        logger.warn(`Rate limit abuse detected for key: ${key.substring(0, 20)}... (${warnings} violations)`);
      }
      
      result.isBlocked = true;
      result.msBeforeNext = config.blockDuration * 1000;
    }
    
    return result;
  }
  
  /**
   * Check rate limit without consuming
   */
  async check(
    key: string,
    config: RateLimitConfig = RateLimitPresets.general
  ): Promise<RateLimitResult> {
    const hashedKey = this.hashKey(key);
    const fullKey = `${config.keyPrefix || 'rl'}:${hashedKey}`;
    
    // Check if blocked
    const blockExpiry = this.blocked.get(fullKey);
    if (blockExpiry && blockExpiry > Date.now()) {
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: blockExpiry - Date.now(),
        consumedPoints: 0,
        isBlocked: true,
      };
    }
    
    // Check bucket
    const bucket = this.limits.get(fullKey);
    if (!bucket) {
      return {
        allowed: true,
        remainingPoints: config.points,
        msBeforeNext: 0,
        consumedPoints: 0,
        isBlocked: false,
      };
    }
    
    return bucket.check();
  }
  
  /**
   * Reset rate limit for a key
   */
  async reset(key: string, prefix?: string): Promise<void> {
    const hashedKey = this.hashKey(key);
    const fullKey = `${prefix || 'rl'}:${hashedKey}`;
    
    this.limits.delete(fullKey);
    this.blocked.delete(fullKey);
    this.warnings.delete(`warn:${hashedKey}`);
  }
  
  /**
   * Get current status for a key
   */
  async getStatus(key: string, prefix?: string): Promise<{
    limited: boolean;
    blocked: boolean;
    warnings: number;
    buckets: number;
  }> {
    const hashedKey = this.hashKey(key);
    const fullKey = `${prefix || 'rl'}:${hashedKey}`;
    
    return {
      limited: this.limits.has(fullKey),
      blocked: this.blocked.has(fullKey) && this.blocked.get(fullKey)! > Date.now(),
      warnings: this.warnings.get(`warn:${hashedKey}`) || 0,
      buckets: this.limits.filter((_, k) => k.includes(hashedKey)).size,
    };
  }
  
  /**
   * Hash key for storage
   */
  private hashKey(key: string): string {
    return createHash('sha256')
      .update(key)
      .digest('hex')
      .substring(0, 16);
  }
  
  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Clean blocked entries
    this.blocked.sweep((expiry) => expiry < now);
    
    // Clean empty buckets
    this.limits.sweep((bucket) => bucket.isEmpty() && bucket.isExpired());
    
    // Clean old warnings (older than 1 hour)
    const warningExpiry = now - 3600000;
    this.warnings.sweep((_, key) => {
      const bucket = this.limits.get(key.replace('warn:', 'rl:'));
      return !bucket || bucket.lastAccess < warningExpiry;
    });
  }
}

// ===========================
// RATE LIMIT BUCKET CLASS
// ===========================

class RateLimitBucket {
  private points: number;
  private resetAt: number;
  public lastAccess: number;
  
  constructor(private config: RateLimitConfig) {
    this.points = config.points;
    this.resetAt = Date.now() + (config.duration * 1000);
    this.lastAccess = Date.now();
  }
  
  consume(): RateLimitResult {
    this.lastAccess = Date.now();
    this.checkReset();
    
    if (this.points <= 0) {
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: this.resetAt - Date.now(),
        consumedPoints: 0,
        isBlocked: false,
      };
    }
    
    this.points--;
    
    return {
      allowed: true,
      remainingPoints: this.points,
      msBeforeNext: this.config.execEvenly 
        ? (this.config.duration * 1000) / this.config.points
        : 0,
      consumedPoints: 1,
      isBlocked: false,
    };
  }
  
  check(): RateLimitResult {
    this.checkReset();
    
    return {
      allowed: this.points > 0,
      remainingPoints: this.points,
      msBeforeNext: this.points > 0 ? 0 : this.resetAt - Date.now(),
      consumedPoints: 0,
      isBlocked: false,
    };
  }
  
  private checkReset(): void {
    if (Date.now() >= this.resetAt) {
      this.points = this.config.points;
      this.resetAt = Date.now() + (this.config.duration * 1000);
    }
  }
  
  isEmpty(): boolean {
    return this.points === this.config.points;
  }
  
  isExpired(): boolean {
    return Date.now() > this.resetAt + 60000; // 1 minute grace period
  }
}

// ===========================
// DISTRIBUTED RATE LIMITER
// ===========================

export class DistributedRateLimiter {
  private limiter: EnhancedRateLimiter;
  
  constructor() {
    this.limiter = new EnhancedRateLimiter();
  }
  
  /**
   * Apply multiple rate limits in sequence
   */
  async consumeMultiple(
    keys: { key: string; config: RateLimitConfig }[]
  ): Promise<RateLimitResult[]> {
    const results: RateLimitResult[] = [];
    
    for (const { key, config } of keys) {
      const result = await this.limiter.consume(key, config);
      results.push(result);
      
      // Stop if any limit is hit
      if (!result.allowed) {
        break;
      }
    }
    
    return results;
  }
  
  /**
   * Apply hierarchical rate limiting (user -> guild -> global)
   */
  async consumeHierarchical(
    userId: string,
    guildId: string,
    commandName: string,
    commandConfig?: RateLimitConfig
  ): Promise<{
    allowed: boolean;
    level?: 'command' | 'user' | 'guild' | 'global';
    result: RateLimitResult;
  }> {
    // Command-specific limit
    if (commandConfig) {
      const commandResult = await this.limiter.consume(
        `cmd:${commandName}:${userId}`,
        commandConfig
      );
      if (!commandResult.allowed) {
        return { allowed: false, level: 'command', result: commandResult };
      }
    }
    
    // User-level limit
    const userResult = await this.limiter.consume(
      `user:${userId}`,
      RateLimitPresets.global
    );
    if (!userResult.allowed) {
      return { allowed: false, level: 'user', result: userResult };
    }
    
    // Guild-level limit
    const guildResult = await this.limiter.consume(
      `guild:${guildId}`,
      RateLimitPresets.guild
    );
    if (!guildResult.allowed) {
      return { allowed: false, level: 'guild', result: guildResult };
    }
    
    // Global limit (all users)
    const globalResult = await this.limiter.consume(
      'global',
      { points: 1000, duration: 60, blockDuration: 300 }
    );
    if (!globalResult.allowed) {
      return { allowed: false, level: 'global', result: globalResult };
    }
    
    return { allowed: true, result: userResult };
  }
  
  /**
   * Apply smart rate limiting with adaptive thresholds
   */
  async consumeAdaptive(
    key: string,
    baseConfig: RateLimitConfig,
    factors: {
      trustScore?: number;      // 0-1, higher = more trusted
      isPremium?: boolean;
      isStaff?: boolean;
      accountAge?: number;      // Days
      previousViolations?: number;
    } = {}
  ): Promise<RateLimitResult> {
    // Calculate adjusted config based on factors
    let points = baseConfig.points;
    let blockDuration = baseConfig.blockDuration || 0;
    
    // Trust score adjustment
    if (factors.trustScore !== undefined) {
      points = Math.floor(points * (1 + factors.trustScore));
    }
    
    // Premium users get 2x limit
    if (factors.isPremium) {
      points *= 2;
    }
    
    // Staff get 5x limit
    if (factors.isStaff) {
      points *= 5;
      blockDuration = 0; // No blocking for staff
    }
    
    // New accounts get stricter limits
    if (factors.accountAge !== undefined && factors.accountAge < 7) {
      points = Math.floor(points * 0.5);
      blockDuration = blockDuration ? blockDuration * 2 : 60;
    }
    
    // Previous violations increase block duration
    if (factors.previousViolations) {
      blockDuration = blockDuration * (1 + factors.previousViolations);
    }
    
    const adjustedConfig: RateLimitConfig = {
      ...baseConfig,
      points,
      blockDuration,
    };
    
    return await this.limiter.consume(key, adjustedConfig);
  }
  
  /**
   * Get rate limiter instance
   */
  getInstance(): EnhancedRateLimiter {
    return this.limiter;
  }
}

// ===========================
// RATE LIMIT MIDDLEWARE
// ===========================

export async function applyRateLimit(
  userId: string,
  guildId: string,
  commandName: string,
  category?: string
): Promise<RateLimitResult> {
  
  // Get appropriate config for command
  let config = RateLimitPresets.general;
  
  if (category) {
    switch (category) {
      case 'moderation':
        config = RateLimitPresets.moderation;
        break;
      case 'economy':
        if (commandName === 'rob') {
          config = RateLimitPresets.rob;
        } else if (commandName === 'daily') {
          config = RateLimitPresets.daily;
        } else if (commandName.includes('gamble')) {
          config = RateLimitPresets.gambling;
        } else {
          config = RateLimitPresets.economy;
        }
        break;
      case 'config':
        config = RateLimitPresets.config;
        break;
      case 'ticket':
        config = RateLimitPresets.ticket;
        break;
      case 'xp':
        config = RateLimitPresets.xp;
        break;
      case 'utility':
        config = RateLimitPresets.utility;
        break;
    }
  }
  
  // Apply hierarchical rate limiting
  const result = await rateLimiterInstance.consumeHierarchical(
    userId,
    guildId,
    commandName,
    config
  );
  
  if (!result.allowed) {
    logger.debug(`Rate limit hit for ${userId} in ${guildId} on ${commandName} (level: ${result.level})`);
  }
  
  return result.result;
}

// Create singleton instance
export const rateLimiterInstance = new DistributedRateLimiter();

// Export for backwards compatibility
export default rateLimiterInstance;