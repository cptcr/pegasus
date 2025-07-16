import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';

interface SecurityConfig {
  maxQueryLength: number;
  maxParameterLength: number;
  allowedTables: string[];
  blockedPatterns: RegExp[];
  maxConcurrentQueries: number;
}

export class SecurityHandler {
  private static instance: SecurityHandler;
  private config: SecurityConfig;
  private queryCount: Map<string, number> = new Map();
  private queryResetInterval: NodeJS.Timeout;

  public static getInstance(): SecurityHandler {
    if (!SecurityHandler.instance) {
      SecurityHandler.instance = new SecurityHandler();
    }
    return SecurityHandler.instance;
  }

  constructor() {
    this.config = {
      maxQueryLength: 5000,
      maxParameterLength: 1000,
      allowedTables: [
        'guild_settings', 'user_profiles', 'mod_actions', 'tickets', 'ticket_panels',
        'temp_channels', 'game_sessions', 'guild_stats', 'log_events', 'voice_sessions',
        'automod_filters', 'automod_violations', 'welcome_settings', 'economy_users',
        'economy_transactions', 'economy_shop_items', 'reaction_role_panels',
        'reaction_roles', 'user_languages', 'steam_cache', 'reminders', 'custom_commands',
        'giveaways', 'giveaway_entries', 'polls', 'poll_votes', 'verification_sessions'
      ],
      blockedPatterns: [
        /(\b(ALTER|CREATE|DROP|TRUNCATE|DELETE|INSERT|UPDATE)\b(?!\s+(USER|GUILD|SETTINGS)))/i,
        /(UNION|EXEC|EXECUTE|SCRIPT|JAVASCRIPT|EVAL)/i,
        /(--|\/\*|\*\/|;)/,
        /(information_schema|pg_|mysql|sys\.)/i,
        /(xp_char|char|ascii|substring|concat)/i,
        /(waitfor|delay|sleep|benchmark)/i
      ],
      maxConcurrentQueries: 50
    };

    this.queryResetInterval = setInterval(() => {
      this.queryCount.clear();
    }, 60000);
  }

  public validateQuery(query: string, parameters: any[] = []): boolean {
    if (query.length > this.config.maxQueryLength) {
      console.warn(`Query exceeds maximum length: ${query.length}`);
      return false;
    }

    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(query)) {
        console.warn(`Query blocked by security pattern: ${pattern}`);
        return false;
      }
    }

    for (const param of parameters) {
      if (typeof param === 'string' && param.length > this.config.maxParameterLength) {
        console.warn(`Parameter exceeds maximum length: ${param.length}`);
        return false;
      }
    }

    return true;
  }

  public sanitizeInput(input: string): string {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>\"']/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .replace(/script/gi, '')
      .trim()
      .substring(0, this.config.maxParameterLength);
  }

  public sanitizeUserId(userId: string): string | null {
    if (!/^\d{17,19}$/.test(userId)) {
      console.warn(`Invalid user ID format: ${userId}`);
      return null;
    }
    return userId;
  }

  public sanitizeGuildId(guildId: string): string | null {
    if (!/^\d{17,19}$/.test(guildId)) {
      console.warn(`Invalid guild ID format: ${guildId}`);
      return null;
    }
    return guildId;
  }

  public sanitizeChannelId(channelId: string): string | null {
    if (!/^\d{17,19}$/.test(channelId)) {
      console.warn(`Invalid channel ID format: ${channelId}`);
      return null;
    }
    return channelId;
  }

  public sanitizeNumber(value: any, min: number = Number.MIN_SAFE_INTEGER, max: number = Number.MAX_SAFE_INTEGER): number | null {
    const num = Number(value);
    if (isNaN(num) || num < min || num > max) {
      console.warn(`Invalid number: ${value}`);
      return null;
    }
    return Math.floor(num);
  }

  public rateLimitCheck(identifier: string): boolean {
    const current = this.queryCount.get(identifier) || 0;
    if (current >= this.config.maxConcurrentQueries) {
      console.warn(`Rate limit exceeded for: ${identifier}`);
      return false;
    }
    this.queryCount.set(identifier, current + 1);
    return true;
  }

  public createSecureQuery(
    baseQuery: string,
    parameters: any[] = [],
    identifier: string = 'default'
  ): { query: string; params: any[] } | null {
    if (!this.rateLimitCheck(identifier)) {
      return null;
    }

    if (!this.validateQuery(baseQuery, parameters)) {
      return null;
    }

    const sanitizedParams = parameters.map(param => {
      if (typeof param === 'string') {
        return this.sanitizeInput(param);
      }
      if (typeof param === 'number') {
        return this.sanitizeNumber(param);
      }
      return param;
    });

    return {
      query: baseQuery,
      params: sanitizedParams
    };
  }

  public validateTableAccess(tableName: string): boolean {
    return this.config.allowedTables.includes(tableName);
  }

  public createRateLimiter(windowMs: number = 60000, max: number = 100) {
    return rateLimit({
      windowMs,
      max,
      message: 'Too many requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  public logSecurityEvent(event: string, details: any, severity: 'low' | 'medium' | 'high' = 'medium'): void {
    const timestamp = new Date().toISOString();
    console.warn(`[SECURITY ${severity.toUpperCase()}] ${timestamp}: ${event}`, details);
    
    if (severity === 'high') {
      console.error(`CRITICAL SECURITY EVENT: ${event}`, details);
    }
  }

  public validatePermissions(userRoles: string[], requiredPermissions: string[]): boolean {
    const adminRoles = ['administrator', 'admin', 'owner'];
    const hasAdmin = userRoles.some(role => adminRoles.includes(role.toLowerCase()));
    
    if (hasAdmin) return true;
    
    return requiredPermissions.every(permission => 
      userRoles.includes(permission)
    );
  }

  public escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  public validateJSON(jsonString: string, maxSize: number = 10000): any | null {
    try {
      if (jsonString.length > maxSize) {
        this.logSecurityEvent('JSON size limit exceeded', { size: jsonString.length });
        return null;
      }
      
      return JSON.parse(jsonString);
    } catch (error) {
      this.logSecurityEvent('Invalid JSON provided', { error: (error as Error).message });
      return null;
    }
  }

  public generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  public cleanup(): void {
    if (this.queryResetInterval) {
      clearInterval(this.queryResetInterval);
    }
  }
}

export const security = SecurityHandler.getInstance();

export function secureQuery(pool: Pool) {
  const originalQuery = pool.query.bind(pool);
  
  pool.query = function(text: string, params?: any[], callback?: any) {
    const secureQueryData = security.createSecureQuery(text, params || [], 'pool');
    
    if (!secureQueryData) {
      security.logSecurityEvent('Query blocked by security handler', { query: text }, 'high');
      if (callback) {
        callback(new Error('Query blocked by security handler'));
        return;
      }
      return Promise.reject(new Error('Query blocked by security handler'));
    }
    
    if (callback) {
      return originalQuery(secureQueryData.query, secureQueryData.params, callback);
    }
    
    return originalQuery(secureQueryData.query, secureQueryData.params);
  } as any;
  
  return pool;
}

export interface SecureUserInput {
  userId?: string;
  guildId?: string;
  channelId?: string;
  roleId?: string;
  messageId?: string;
  text?: string;
  number?: number;
  duration?: number;
  url?: string;
  json?: string;
}

export function validateUserInput(input: SecureUserInput): SecureUserInput | null {
  const result: SecureUserInput = {};
  
  if (input.userId) {
    const sanitizedUserId = security.sanitizeUserId(input.userId);
    if (!sanitizedUserId) return null;
    result.userId = sanitizedUserId;
  }
  
  if (input.guildId) {
    const sanitizedGuildId = security.sanitizeGuildId(input.guildId);
    if (!sanitizedGuildId) return null;
    result.guildId = sanitizedGuildId;
  }
  
  if (input.channelId) {
    const sanitizedChannelId = security.sanitizeChannelId(input.channelId);
    if (!sanitizedChannelId) return null;
    result.channelId = sanitizedChannelId;
  }
  
  if (input.roleId) {
    const sanitizedRoleId = security.sanitizeChannelId(input.roleId);
    if (!sanitizedRoleId) return null;
    result.roleId = sanitizedRoleId;
  }
  
  if (input.messageId) {
    const sanitizedMessageId = security.sanitizeChannelId(input.messageId);
    if (!sanitizedMessageId) return null;
    result.messageId = sanitizedMessageId;
  }
  
  if (input.text) {
    result.text = security.sanitizeInput(input.text);
  }
  
  if (input.number !== undefined) {
    const sanitizedNumber = security.sanitizeNumber(input.number);
    if (sanitizedNumber === null) return null;
    result.number = sanitizedNumber;
  }
  
  if (input.duration !== undefined) {
    const sanitizedDuration = security.sanitizeNumber(input.duration, 0, 31536000000);
    if (sanitizedDuration === null) return null;
    result.duration = sanitizedDuration;
  }
  
  if (input.url) {
    try {
      new URL(input.url);
      result.url = input.url;
    } catch {
      security.logSecurityEvent('Invalid URL provided', { url: input.url });
      return null;
    }
  }
  
  if (input.json) {
    const parsed = security.validateJSON(input.json);
    if (!parsed) return null;
    result.json = input.json;
  }
  
  return result;
}