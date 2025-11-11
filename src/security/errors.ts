import { EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger';

/**
 * Base security error class
 */
export abstract class SecurityError extends Error {
  public readonly code: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.timestamp = new Date();
    this.context = context;

    // Log security errors
    logger.error(`[${this.severity.toUpperCase()}] ${this.code}: ${message}`, context);
  }

  /**
   * Convert error to embed for Discord display
   */
  toEmbed(): EmbedBuilder {
    const colors = {
      low: 0x00ff00,
      medium: 0xffff00,
      high: 0xffa500,
      critical: 0xff0000,
    };

    return new EmbedBuilder()
      .setColor(colors[this.severity])
      .setTitle('Security Error')
      .setDescription(this.message)
      .addFields(
        { name: 'Error Code', value: this.code, inline: true },
        { name: 'Severity', value: this.severity.toUpperCase(), inline: true }
      )
      .setTimestamp(this.timestamp);
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends SecurityError {
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number, context?: Record<string, unknown>) {
    super(message, 'RATE_LIMIT_EXCEEDED', 'low', context);
    this.retryAfter = retryAfter;
  }
}

/**
 * Permission denied error
 */
export class PermissionError extends SecurityError {
  public readonly missingPermissions: string[];

  constructor(
    message: string,
    missingPermissions: string[] = [],
    context?: Record<string, unknown>
  ) {
    super(message, 'PERMISSION_DENIED', 'medium', context);
    this.missingPermissions = missingPermissions;
  }
}

/**
 * Validation error
 */
export class ValidationError extends SecurityError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_FAILED', 'low', { ...context, field, value });
    this.field = field;
    this.value = value;
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends SecurityError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_FAILED', 'high', context);
  }
}

/**
 * Blacklist error
 */
export class BlacklistError extends SecurityError {
  public readonly entityType: 'user' | 'guild' | 'role';
  public readonly entityId: string;

  constructor(
    entityType: 'user' | 'guild' | 'role',
    entityId: string,
    context?: Record<string, unknown>
  ) {
    super(`${entityType} ${entityId} is blacklisted`, 'BLACKLISTED', 'high', {
      ...context,
      entityType,
      entityId,
    });
    this.entityType = entityType;
    this.entityId = entityId;
  }
}

/**
 * Suspicious activity error
 */
export class SuspiciousActivityError extends SecurityError {
  public readonly activityType: string;

  constructor(activityType: string, message: string, context?: Record<string, unknown>) {
    super(message, 'SUSPICIOUS_ACTIVITY', 'critical', { ...context, activityType });
    this.activityType = activityType;
  }
}

/**
 * Token compromise error
 */
export class TokenCompromiseError extends SecurityError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TOKEN_COMPROMISE', 'critical', context);
  }
}

/**
 * SQL injection attempt error
 */
export class SQLInjectionError extends SecurityError {
  public readonly query?: string;

  constructor(query?: string, context?: Record<string, unknown>) {
    super('SQL injection attempt detected', 'SQL_INJECTION_ATTEMPT', 'critical', {
      ...context,
      query,
    });
    this.query = query;
  }
}

/**
 * XSS attempt error
 */
export class XSSError extends SecurityError {
  public readonly payload?: string;

  constructor(payload?: string, context?: Record<string, unknown>) {
    super('XSS attempt detected', 'XSS_ATTEMPT', 'high', { ...context, payload });
    this.payload = payload;
  }
}

/**
 * Global error handler for security errors
 */
export class SecurityErrorHandler {
  /**
   * Handle security error and return appropriate response
   */
  static handle(error: Error): {
    message: string;
    embed?: EmbedBuilder;
    shouldLog: boolean;
    shouldAlert: boolean;
  } {
    // Security errors
    if (error instanceof SecurityError) {
      const shouldAlert = error.severity === 'critical' || error.severity === 'high';

      return {
        message: this.getSafeErrorMessage(error),
        embed: error.toEmbed(),
        shouldLog: true,
        shouldAlert,
      };
    }

    // Generic errors - don't expose details
    return {
      message: 'An error occurred while processing your request.',
      shouldLog: true,
      shouldAlert: false,
    };
  }

  /**
   * Get safe error message for user display
   */
  private static getSafeErrorMessage(error: SecurityError): string {
    switch (error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        return `You're doing that too fast! Please wait ${(error as RateLimitError).retryAfter} seconds.`;

      case 'PERMISSION_DENIED':
        return "You don't have permission to do that.";

      case 'VALIDATION_FAILED':
        return 'Invalid input provided. Please check your input and try again.';

      case 'BLACKLISTED':
        return 'Access denied.';

      case 'AUTHENTICATION_FAILED':
        return 'Authentication failed. Please try again.';

      case 'SUSPICIOUS_ACTIVITY':
      case 'TOKEN_COMPROMISE':
      case 'SQL_INJECTION_ATTEMPT':
      case 'XSS_ATTEMPT':
        return 'Security violation detected. This incident has been logged.';

      default:
        return 'An error occurred. Please try again later.';
    }
  }

  /**
   * Create alert for critical security errors
   */
  static createAlert(error: SecurityError): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('🚨 Security Alert')
      .setDescription(`A ${error.severity} severity security event has occurred`)
      .addFields(
        { name: 'Error Type', value: error.name, inline: true },
        { name: 'Error Code', value: error.code, inline: true },
        { name: 'Timestamp', value: error.timestamp.toISOString(), inline: false },
        { name: 'Message', value: error.message, inline: false }
      )
      .setFooter({ text: 'Immediate action may be required' })
      .setTimestamp();
  }
}
