import { Collection } from 'discord.js';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

export interface RateLimitOptions {
  points: number;          // Number of points
  duration: number;        // Per duration in seconds
  blockDuration?: number;  // Block duration in seconds when limit exceeded
  execEvenly?: boolean;    // Spread requests evenly
}

export interface RateLimitResult {
  allowed: boolean;
  remainingPoints: number;
  msBeforeNext: number;
  consumedPoints: number;
  isBlocked: boolean;
}

// Rate limit configurations
export const RateLimitConfigs = {
  // Global limits
  global: {
    command: { points: 10, duration: 60, blockDuration: 300 },    // 10 commands per minute
    api: { points: 30, duration: 60, blockDuration: 600 },        // 30 API calls per minute
  },
  
  // Per-command limits
  commands: {
    // Economy commands
    'economy.gamble': { points: 5, duration: 60, blockDuration: 300 },
    'economy.work': { points: 1, duration: 86400 },                // Once per day
    'economy.daily': { points: 1, duration: 86400 },               // Once per day
    'economy.rob': { points: 1, duration: 86400, blockDuration: 3600 },
    
    // Moderation commands
    'moderation.ban': { points: 5, duration: 300 },
    'moderation.kick': { points: 10, duration: 300 },
    'moderation.warn': { points: 20, duration: 300 },
    'moderation.purge': { points: 3, duration: 60 },
    
    // Utility commands
    'utility.help': { points: 5, duration: 60 },
    'utility.ping': { points: 10, duration: 60 },
    
    // Expensive operations
    'xp.leaderboard': { points: 3, duration: 60 },
    'giveaway.start': { points: 2, duration: 300 },
    'ticket.create': { points: 3, duration: 300 },
  },
  
  // Per-guild limits
  guild: {
    commands: { points: 100, duration: 60 },      // 100 commands per minute per guild
    configChanges: { points: 10, duration: 300 }, // 10 config changes per 5 minutes
    tickets: { points: 10, duration: 3600 },       // 10 tickets per hour
  },
  
  // Anti-spam limits
  spam: {
    mentions: { points: 5, duration: 60, blockDuration: 3600 },      // 5 mentions per minute
    links: { points: 10, duration: 60, blockDuration: 1800 },        // 10 links per minute
    duplicates: { points: 3, duration: 60, blockDuration: 600 },     // 3 duplicate messages
    capsLock: { points: 5, duration: 60, blockDuration: 300 },       // 5 caps messages
  },
};

export class RateLimiter {
  private memoryStorage: Collection<string, { points: number; expire: number }>;
  private redis?: Redis;
  
  constructor(redis?: Redis) {
    this.memoryStorage = new Collection();
    this.redis = redis;
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }
  
  /**
   * Consumes points for a given key
   */
  async consume(key: string, points: number = 1, options: RateLimitOptions): Promise<RateLimitResult> {
    const now = Date.now();
    const duration = options.duration * 1000;
    const blockDuration = (options.blockDuration || 0) * 1000;
    
    // Try Redis first if available
    if (this.redis) {
      try {
        return await this.consumeRedis(key, points, options);
      } catch (error) {
        logger.error('Redis rate limit error, falling back to memory:', error);
      }
    }
    
    // Memory storage fallback
    const data = this.memoryStorage.get(key);
    const expire = now + duration;
    
    // Check if blocked
    if (data && data.expire > now && data.points < 0) {
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: data.expire - now,
        consumedPoints: 0,
        isBlocked: true,
      };
    }
    
    // Initialize or reset if expired
    if (!data || data.expire <= now) {
      this.memoryStorage.set(key, { points: options.points - points, expire });
      return {
        allowed: true,
        remainingPoints: options.points - points,
        msBeforeNext: options.execEvenly ? duration / options.points : 0,
        consumedPoints: points,
        isBlocked: false,
      };
    }
    
    // Check if enough points
    if (data.points < points) {
      // Block if configured
      if (blockDuration > 0) {
        this.memoryStorage.set(key, { points: -1, expire: now + blockDuration });
      }
      
      return {
        allowed: false,
        remainingPoints: Math.max(0, data.points),
        msBeforeNext: data.expire - now,
        consumedPoints: 0,
        isBlocked: blockDuration > 0,
      };
    }
    
    // Consume points
    data.points -= points;
    return {
      allowed: true,
      remainingPoints: data.points,
      msBeforeNext: options.execEvenly ? duration / options.points : 0,
      consumedPoints: points,
      isBlocked: false,
    };
  }
  
  /**
   * Redis-based rate limiting
   */
  private async consumeRedis(key: string, points: number, options: RateLimitOptions): Promise<RateLimitResult> {
    if (!this.redis) throw new Error('Redis not configured');
    
    const fullKey = `ratelimit:${key}`;
    const now = Date.now();
    
    // Check if blocked
    const blockedKey = `${fullKey}:blocked`;
    const blockTtl = await this.redis.ttl(blockedKey);
    if (blockTtl > 0) {
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: blockTtl * 1000,
        consumedPoints: 0,
        isBlocked: true,
      };
    }
    
    // Lua script for atomic rate limit check and consume
    const luaScript = `
      local key = KEYS[1]
      local points_to_consume = tonumber(ARGV[1])
      local max_points = tonumber(ARGV[2])
      local duration = tonumber(ARGV[3])
      local block_duration = tonumber(ARGV[4])
      
      local current = redis.call('get', key)
      if current == false then
        redis.call('set', key, max_points - points_to_consume, 'EX', duration)
        return {1, max_points - points_to_consume}
      end
      
      local points = tonumber(current)
      if points < points_to_consume then
        if block_duration > 0 then
          redis.call('set', key .. ':blocked', '1', 'EX', block_duration)
        end
        return {0, points}
      end
      
      redis.call('decrby', key, points_to_consume)
      return {1, points - points_to_consume}
    `;
    
    const result = await this.redis.eval(
      luaScript,
      1,
      fullKey,
      points,
      options.points,
      options.duration,
      options.blockDuration || 0
    ) as [number, number];
    
    const [allowed, remaining] = result;
    const ttl = await this.redis.ttl(fullKey);
    
    return {
      allowed: allowed === 1,
      remainingPoints: remaining,
      msBeforeNext: ttl > 0 ? ttl * 1000 : 0,
      consumedPoints: allowed === 1 ? points : 0,
      isBlocked: allowed === 0 && options.blockDuration ? true : false,
    };
  }
  
  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(`ratelimit:${key}`, `ratelimit:${key}:blocked`);
    }
    this.memoryStorage.delete(key);
  }
  
  /**
   * Get current state for a key
   */
  async get(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    return this.consume(key, 0, options);
  }
  
  /**
   * Clean up expired entries from memory
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, data] of this.memoryStorage) {
      if (data.expire <= now) {
        this.memoryStorage.delete(key);
      }
    }
  }
  
  /**
   * Create rate limit key
   */
  static createKey(type: string, ...identifiers: string[]): string {
    return `${type}:${identifiers.join(':')}`;
  }
  
  /**
   * Check multiple rate limits
   */
  async checkLimits(limits: Array<{ key: string; points?: number; config: RateLimitOptions }>): Promise<boolean> {
    for (const limit of limits) {
      const result = await this.consume(limit.key, limit.points || 1, limit.config);
      if (!result.allowed) {
        return false;
      }
    }
    return true;
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Rate limit middleware for commands
export async function checkCommandRateLimit(
  userId: string,
  guildId: string,
  commandName: string
): Promise<RateLimitResult> {
  const limits = [
    // Global user limit
    {
      key: RateLimiter.createKey('global', userId),
      config: RateLimitConfigs.global.command,
    },
    // Per-guild limit
    {
      key: RateLimiter.createKey('guild', guildId),
      config: RateLimitConfigs.guild.commands,
    },
    // Per-command limit
    {
      key: RateLimiter.createKey('command', userId, commandName),
      config: RateLimitConfigs.commands[commandName] || RateLimitConfigs.global.command,
    },
  ];
  
  for (const limit of limits) {
    const result = await rateLimiter.consume(limit.key, 1, limit.config);
    if (!result.allowed) {
      return result;
    }
  }
  
  return {
    allowed: true,
    remainingPoints: Infinity,
    msBeforeNext: 0,
    consumedPoints: 1,
    isBlocked: false,
  };
}