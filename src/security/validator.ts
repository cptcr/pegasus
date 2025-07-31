import { z } from 'zod';
import { logger } from '../utils/logger';

export class InputValidator {
  // Common validation schemas
  static readonly schemas = {
    discordId: z.string().regex(/^\d{17,19}$/),
    username: z.string().min(1).max(32).regex(/^[a-zA-Z0-9_]{1,32}$/),
    guildId: z.string().regex(/^\d{17,19}$/),
    channelId: z.string().regex(/^\d{17,19}$/),
    roleId: z.string().regex(/^\d{17,19}$/),
    messageId: z.string().regex(/^\d{17,19}$/),
    
    // Command input schemas
    reason: z.string().max(512).optional(),
    duration: z.string().regex(/^\d+[mhdwMy]?$/),
    amount: z.number().int().positive().max(1000000000),
    
    // General text inputs
    shortText: z.string().min(1).max(100),
    mediumText: z.string().min(1).max(1024),
    longText: z.string().min(1).max(4096),
    
    // URLs and special formats
    url: z.string().url(),
    email: z.string().email(),
    hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    
    // Arrays with limits
    idArray: z.array(z.string().regex(/^\d{17,19}$/)).max(25),
    stringArray: z.array(z.string().max(100)).max(25),
  };

  /**
   * Validate input against a schema
   */
  static validate<T>(schema: z.ZodSchema<T>, input: unknown): T | null {
    try {
      return schema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Input validation failed', {
          errors: error.errors,
          input: JSON.stringify(input).slice(0, 100)
        });
      }
      return null;
    }
  }

  /**
   * Sanitize text input to prevent injection attacks
   */
  static sanitizeText(text: string): string {
    return text
      .replace(/```/g, '\\`\\`\\`') // Escape code blocks
      .replace(/@(everyone|here)/g, '@\u200b$1') // Break mentions
      .replace(/<@[!&]?\d+>/g, (match) => `\\${match}`) // Escape user/role mentions
      .replace(/https?:\/\/[^\s]+/g, (url) => {
        // Validate URLs
        try {
          new URL(url);
          return url;
        } catch {
          return '[Invalid URL]';
        }
      })
      .trim();
  }

  /**
   * Sanitize SQL identifiers (table names, column names)
   */
  static sanitizeSQLIdentifier(identifier: string): string {
    // Only allow alphanumeric characters and underscores
    const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Ensure it doesn't start with a number
    if (/^\d/.test(sanitized)) {
      return `_${sanitized}`;
    }
    
    return sanitized;
  }

  /**
   * Validate and sanitize file paths
   */
  static sanitizeFilePath(path: string): string | null {
    // Remove any path traversal attempts
    const sanitized = path
      .replace(/\.\./g, '')
      .replace(/[<>:"|?*]/g, '')
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/');
    
    // Ensure the path doesn't start with / or contain absolute paths
    if (sanitized.startsWith('/') || /^[a-zA-Z]:/.test(sanitized)) {
      return null;
    }
    
    return sanitized;
  }

  /**
   * Create a rate limit key from user context
   */
  static createRateLimitKey(userId: string, commandName: string): string {
    return `ratelimit:${userId}:${commandName}`;
  }

  /**
   * Check if a string contains potential SQL injection patterns
   */
  static containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript)\b)/gi,
      /(--|#|\/\*|\*\/|xp_|sp_)/gi,
      /(\bor\b\s*\d+\s*=\s*\d+|\band\b\s*\d+\s*=\s*\d+)/gi,
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate Discord permissions
   */
  static validatePermissions(permissions: bigint, required: bigint[]): boolean {
    return required.every(perm => (permissions & perm) === perm);
  }

  /**
   * Generate a secure random token
   */
  static generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      token += chars[randomIndex];
    }
    
    return token;
  }

  /**
   * Hash sensitive data for storage
   */
  static async hashData(data: string): Promise<string> {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Validate webhook URL
   */
  static isValidWebhook(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && 
             (parsed.hostname.endsWith('discord.com') || 
              parsed.hostname.endsWith('discordapp.com'));
    } catch {
      return false;
    }
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitive(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars * 2) {
      return '*'.repeat(data.length);
    }
    
    const start = data.slice(0, visibleChars);
    const end = data.slice(-visibleChars);
    const masked = '*'.repeat(Math.max(4, data.length - visibleChars * 2));
    
    return `${start}${masked}${end}`;
  }
}