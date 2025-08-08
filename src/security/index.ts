import {
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  WebhookClient,
  Colors,
} from 'discord.js';
import { rateLimiterInstance, RateLimitPresets } from '../middleware/rateLimiter';
import { PermissionChecker } from '../middleware/permissions';
import { EnhancedSanitizer, sanitizeUserInput } from '../utils/sanitizer';
import { SchemaValidator } from '../validation/schemas';
import { logger } from '../utils/logger';
import type { Command } from '../types/command';

// ===========================
// SECURITY CONFIGURATION
// ===========================

export interface SecurityConfig {
  enableRateLimiting: boolean;
  enablePermissionChecks: boolean;
  enableInputValidation: boolean;
  enableSanitization: boolean;
  enableAuditLogging: boolean;
  enableSecurityAlerts: boolean;
  alertWebhookUrl?: string;
  maxViolationsBeforeBan: number;
  violationDecayTime: number; // ms
  trustedRoles: string[];
  immuneUsers: string[];
}

const defaultConfig: SecurityConfig = {
  enableRateLimiting: true,
  enablePermissionChecks: true,
  enableInputValidation: true,
  enableSanitization: true,
  enableAuditLogging: true,
  enableSecurityAlerts: true,
  alertWebhookUrl: process.env.SECURITY_WEBHOOK_URL,
  maxViolationsBeforeBan: 10,
  violationDecayTime: 3600000, // 1 hour
  trustedRoles: [],
  immuneUsers: [process.env.BOT_OWNER_ID!].filter(Boolean),
};

// ===========================
// CENTRAL SECURITY MANAGER
// ===========================

export class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  private violations: Map<string, ViolationRecord> = new Map();
  private alertWebhook?: WebhookClient;

  private constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    if (this.config.alertWebhookUrl) {
      try {
        this.alertWebhook = new WebhookClient({ url: this.config.alertWebhookUrl });
      } catch (error) {
        logger.error('Failed to initialize security webhook:', error);
      }
    }

    // Clean up old violations periodically
    setInterval(() => this.cleanupViolations(), 60000);
  }

  static getInstance(config?: Partial<SecurityConfig>): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager(config);
    }
    return SecurityManager.instance;
  }

  /**
   * Main security check for commands
   */
  async validateCommand(
    interaction: ChatInputCommandInteraction,
    command: Command
  ): Promise<SecurityCheckResult> {
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    // Check if user is immune
    if (this.config.immuneUsers.includes(userId)) {
      return { allowed: true, checks: {} };
    }

    const checks: SecurityChecks = {};

    // 1. Rate Limiting
    if (this.config.enableRateLimiting) {
      const rateLimitResult = await this.checkRateLimit(
        userId,
        guildId,
        command.data.name,
        command.category
      );
      checks.rateLimit = rateLimitResult;

      if (!rateLimitResult.passed) {
        await this.recordViolation(userId, 'rate_limit', interaction);
        return {
          allowed: false,
          reason: `Rate limited. Try again in ${Math.ceil(rateLimitResult.retryAfter! / 1000)} seconds.`,
          checks,
        };
      }
    }

    // 2. Permission Checks
    if (this.config.enablePermissionChecks && command.permissions) {
      const permissionResult = await this.checkPermissions(interaction, command.permissions);
      checks.permissions = permissionResult;

      if (!permissionResult.passed) {
        await this.recordViolation(userId, 'permission', interaction);
        return {
          allowed: false,
          reason: permissionResult.reason || 'Insufficient permissions',
          checks,
        };
      }
    }

    // 3. Input Validation
    if (this.config.enableInputValidation) {
      const validationResult = await this.validateInput(interaction);
      checks.validation = validationResult;

      if (!validationResult.passed) {
        await this.recordViolation(userId, 'validation', interaction);
        return {
          allowed: false,
          reason: validationResult.reason || 'Invalid input',
          checks,
        };
      }
    }

    // 4. Check for security violations
    const violationCheck = await this.checkViolations(userId);
    if (violationCheck.banned) {
      return {
        allowed: false,
        reason: 'You have been temporarily banned due to security violations',
        checks,
      };
    }

    // Log successful security check
    if (this.config.enableAuditLogging) {
      logger.debug(
        `Security check passed for ${interaction.user.tag} executing ${command.data.name}`
      );
    }

    return { allowed: true, checks };
  }

  /**
   * Validate message content
   */
  async validateMessage(message: Message): Promise<MessageSecurityResult> {
    if (message.author.bot) {
      return { allowed: true };
    }

    const content = message.content;

    // Check for mass mentions
    const mentionCheck = EnhancedSanitizer.hasMassMentions(content);
    if (mentionCheck.detected) {
      await this.recordViolation(message.author.id, 'mass_mention', message);
      await this.sendSecurityAlert(
        'Mass Mention Detected',
        `User ${message.author.tag} attempted mass mentions`,
        'high',
        {
          userId: message.author.id,
          guildId: message.guildId!,
          counts: mentionCheck.counts,
        }
      );
      return {
        allowed: false,
        reason: 'Mass mentions detected',
        shouldDelete: true,
        shouldTimeout: mentionCheck.counts.total > 20,
      };
    }

    // Check for spam
    const spamCheck = EnhancedSanitizer.isSpam(content);
    if (spamCheck.isSpam) {
      await this.recordViolation(message.author.id, 'spam', message);
      return {
        allowed: false,
        reason: 'Message detected as spam',
        shouldDelete: true,
        shouldTimeout: spamCheck.score >= 4,
      };
    }

    // Check for sensitive data
    if (content.match(/[\w-]{24}\.[\w-]{6}\.[\w-]{27,}/)) {
      await this.sendSecurityAlert(
        'Discord Token Detected',
        `Possible Discord token leak in message`,
        'critical',
        {
          userId: message.author.id,
          guildId: message.guildId!,
          channelId: message.channelId,
        }
      );
      return {
        allowed: false,
        reason: 'Sensitive data detected',
        shouldDelete: true,
      };
    }

    return { allowed: true };
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(
    userId: string,
    guildId: string,
    commandName: string,
    category?: string
  ): Promise<SecurityCheckDetail> {
    const result = await rateLimiterInstance.consumeHierarchical(
      userId,
      guildId,
      commandName,
      this.getRateLimitConfig(category)
    );

    return {
      passed: result.allowed,
      reason: result.allowed ? undefined : `Rate limit exceeded at ${result.level} level`,
      retryAfter: result.result.msBeforeNext,
    };
  }

  /**
   * Check permissions
   */
  private async checkPermissions(
    interaction: ChatInputCommandInteraction,
    requirements: any
  ): Promise<SecurityCheckDetail> {
    const result = await PermissionChecker.check(interaction, requirements);

    return {
      passed: result.allowed,
      reason: result.reason,
      details: {
        missingPermissions: result.missingPermissions,
        missingRoles: result.missingRoles,
      },
    };
  }

  /**
   * Validate command input
   */
  private async validateInput(
    interaction: ChatInputCommandInteraction
  ): Promise<SecurityCheckDetail> {
    const commandName = interaction.commandName;
    const subcommand = interaction.options.getSubcommand(false);

    // Extract options
    const options: Record<string, any> = {};
    interaction.options.data.forEach(opt => {
      if (opt.type === 1) {
        // Subcommand
        opt.options?.forEach(subOpt => {
          // Sanitize string inputs
          if (typeof subOpt.value === 'string') {
            options[subOpt.name] = sanitizeUserInput(subOpt.value);
          } else {
            options[subOpt.name] = subOpt.value;
          }
        });
      } else {
        // Sanitize string inputs
        if (typeof opt.value === 'string') {
          options[opt.name] = sanitizeUserInput(opt.value);
        } else {
          options[opt.name] = opt.value;
        }
      }
    });

    // Validate against schema
    const validation = SchemaValidator.validateCommand(commandName, subcommand, options);

    if (!validation.success) {
      return {
        passed: false,
        reason: validation.error,
      };
    }

    // Additional security checks
    for (const [key, value] of Object.entries(options)) {
      if (typeof value === 'string') {
        // Check for injection attempts
        if (value.includes('${') || value.includes('`')) {
          return {
            passed: false,
            reason: 'Potential injection attempt detected',
          };
        }

        // Check for excessive length
        if (value.length > 4000) {
          return {
            passed: false,
            reason: `Input too long for field ${key}`,
          };
        }
      }
    }

    return { passed: true };
  }

  /**
   * Record security violation
   */
  private async recordViolation(
    userId: string,
    type: ViolationType,
    context: ChatInputCommandInteraction | Message
  ): Promise<void> {
    let record = this.violations.get(userId);

    if (!record) {
      record = {
        userId,
        violations: [],
        totalCount: 0,
        banned: false,
        bannedUntil: null,
      };
      this.violations.set(userId, record);
    }

    record.violations.push({
      type,
      timestamp: Date.now(),
      guildId:
        'guildId' in context ? (context as any).guildId : (context as any).guild?.id || undefined,
    });
    record.totalCount++;

    // Check if should ban
    if (record.totalCount >= this.config.maxViolationsBeforeBan) {
      record.banned = true;
      record.bannedUntil = Date.now() + 3600000; // 1 hour ban

      await this.sendSecurityAlert(
        'User Auto-Banned',
        `User reached violation threshold`,
        'critical',
        {
          userId,
          violationCount: record.totalCount,
          recentViolations: record.violations.slice(-5),
        }
      );
    }

    // Log violation
    logger.warn(`Security violation recorded for ${userId}: ${type}`);
  }

  /**
   * Check user violations
   */
  private async checkViolations(userId: string): Promise<{ banned: boolean; count: number }> {
    const record = this.violations.get(userId);

    if (!record) {
      return { banned: false, count: 0 };
    }

    // Check if ban expired
    if (record.banned && record.bannedUntil && Date.now() > record.bannedUntil) {
      record.banned = false;
      record.bannedUntil = null;
    }

    return {
      banned: record.banned,
      count: record.totalCount,
    };
  }

  /**
   * Send security alert
   */
  private async sendSecurityAlert(
    title: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    data?: any
  ): Promise<void> {
    if (!this.config.enableSecurityAlerts) {
      return;
    }

    const colors = {
      low: Colors.Blue,
      medium: Colors.Yellow,
      high: Colors.Orange,
      critical: Colors.Red,
    };

    const embed = new EmbedBuilder()
      .setTitle(`Security Alert: ${title}`)
      .setDescription(description)
      .setColor(colors[severity])
      .addFields({
        name: 'Severity',
        value: severity.toUpperCase(),
        inline: true,
      })
      .setTimestamp();

    if (data) {
      embed.addFields({
        name: 'Details',
        value: '```json\n' + JSON.stringify(data, null, 2).substring(0, 1000) + '```',
        inline: false,
      });
    }

    // Log locally
    logger.warn(`SECURITY ALERT [${severity.toUpperCase()}]: ${title} - ${description}`);

    // Send to webhook if configured
    if (this.alertWebhook) {
      try {
        await this.alertWebhook.send({
          embeds: [embed],
          username: 'Security Monitor',
        });
      } catch (error) {
        logger.error('Failed to send security alert:', error);
      }
    }
  }

  /**
   * Get rate limit config for category
   */
  private getRateLimitConfig(category?: string) {
    switch (category) {
      case 'moderation':
        return RateLimitPresets.moderation;
      case 'economy':
        return RateLimitPresets.economy;
      case 'config':
        return RateLimitPresets.config;
      default:
        return RateLimitPresets.general;
    }
  }

  /**
   * Clean up old violations
   */
  private cleanupViolations(): void {
    const now = Date.now();
    const decayTime = this.config.violationDecayTime;

    for (const [userId, record] of this.violations.entries()) {
      // Remove old violations
      record.violations = record.violations.filter(v => now - v.timestamp < decayTime);

      // Remove record if no recent violations
      if (record.violations.length === 0 && !record.banned) {
        this.violations.delete(userId);
      }
    }
  }

  /**
   * Get security status for user
   */
  async getUserSecurityStatus(userId: string): Promise<UserSecurityStatus> {
    const violations = this.violations.get(userId);
    const rateLimitStatus = await rateLimiterInstance.getInstance().getStatus(`user:${userId}`);

    return {
      userId,
      violations: violations?.totalCount || 0,
      recentViolations: violations?.violations.slice(-10) || [],
      banned: violations?.banned || false,
      bannedUntil: violations?.bannedUntil || null,
      rateLimited: rateLimitStatus.limited,
      trustScore: this.calculateTrustScore(userId),
    };
  }

  /**
   * Calculate user trust score
   */
  private calculateTrustScore(userId: string): number {
    const violations = this.violations.get(userId);

    if (!violations) {
      return 1.0; // Maximum trust
    }

    // Decrease trust based on violations
    const violationPenalty = Math.min(violations.totalCount * 0.1, 0.9);

    // Recent violations have more impact
    const recentViolations = violations.violations.filter(
      v => Date.now() - v.timestamp < 86400000 // 24 hours
    ).length;
    const recentPenalty = recentViolations * 0.15;

    return Math.max(0, 1 - violationPenalty - recentPenalty);
  }
}

// ===========================
// TYPE DEFINITIONS
// ===========================

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  checks?: SecurityChecks;
}

export interface SecurityChecks {
  rateLimit?: SecurityCheckDetail;
  permissions?: SecurityCheckDetail;
  validation?: SecurityCheckDetail;
}

export interface SecurityCheckDetail {
  passed: boolean;
  reason?: string;
  retryAfter?: number;
  details?: any;
}

export interface MessageSecurityResult {
  allowed: boolean;
  reason?: string;
  shouldDelete?: boolean;
  shouldTimeout?: boolean;
  timeoutDuration?: number;
}

export interface ViolationRecord {
  userId: string;
  violations: Violation[];
  totalCount: number;
  banned: boolean;
  bannedUntil: number | null;
}

export interface Violation {
  type: ViolationType;
  timestamp: number;
  guildId?: string;
}

export type ViolationType =
  | 'rate_limit'
  | 'permission'
  | 'validation'
  | 'spam'
  | 'mass_mention'
  | 'injection'
  | 'suspicious_activity';

export interface UserSecurityStatus {
  userId: string;
  violations: number;
  recentViolations: Violation[];
  banned: boolean;
  bannedUntil: number | null;
  rateLimited: boolean;
  trustScore: number;
}

// ===========================
// SECURITY MIDDLEWARE
// ===========================

/**
 * Apply security checks to a command
 */
export async function applySecurityMiddleware(
  interaction: ChatInputCommandInteraction,
  command: Command
): Promise<SecurityCheckResult> {
  const security = SecurityManager.getInstance();
  return security.validateCommand(interaction, command);
}

/**
 * Apply security checks to a message
 */
export async function applyMessageSecurity(message: Message): Promise<MessageSecurityResult> {
  const security = SecurityManager.getInstance();
  return security.validateMessage(message);
}

// Export singleton instance
export const securityManager = SecurityManager.getInstance();
export default SecurityManager;

// Re-export existing modules
export * from './audit';
export { Validator, CommandSchemas } from './validator';
export * from './rateLimiter';
export * from './sanitizer';
export * from './permissions';
export * from './middleware';
export {
  SecurityError,
  RateLimitError,
  BlacklistError,
  SuspiciousActivityError,
  ValidationError as SecurityValidationError,
} from './errors';
export * from './crypto';
