import { 
  ChatInputCommandInteraction, 
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  GuildMember
} from 'discord.js';
import { InputValidator } from './validator';
import { rateLimiter } from './rateLimiter';
import { permissions } from './permissions';
import { auditLogger, AuditCategories, AuditActions } from './audit';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface SecurityContext {
  userId: string;
  guildId: string;
  command?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export class SecurityMiddleware {
  /**
   * Main security check for interactions
   */
  async checkInteraction(
    interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      if (!interaction.guild || !interaction.member) {
        return { allowed: false, reason: 'This command can only be used in a server.' };
      }

      const member = interaction.member as GuildMember;
      const context: SecurityContext = {
        userId: member.id,
        guildId: interaction.guild.id,
        command: interaction.isChatInputCommand() ? interaction.commandName : undefined,
        action: interaction.isButton() ? interaction.customId : undefined
      };

      // 1. Check rate limits
      const rateLimitCheck = await this.checkRateLimit(context);
      if (!rateLimitCheck.allowed) {
        return rateLimitCheck;
      }

      // 2. Check permissions (only for commands)
      if (interaction.isChatInputCommand()) {
        const permissionCheck = await this.checkPermissions(interaction);
        if (!permissionCheck.allowed) {
          return permissionCheck;
        }
      }

      // 3. Validate inputs (for commands and modals)
      if (interaction.isChatInputCommand() || interaction.isModalSubmit()) {
        const validationCheck = await this.validateInputs(interaction);
        if (!validationCheck.allowed) {
          return validationCheck;
        }
      }

      // 4. Check for suspicious activity
      const suspiciousCheck = await this.checkSuspiciousActivity(context);
      if (!suspiciousCheck.allowed) {
        return suspiciousCheck;
      }

      // Log successful security check
      if (interaction.isChatInputCommand()) {
        await auditLogger.log(
          context.userId,
          context.guildId,
          `command_executed`,
          AuditCategories.USER_ACTION,
          { command: interaction.commandName }
        );
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Security check failed', error as Error);
      return { allowed: false, reason: 'Security check failed. Please try again later.' };
    }
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(context: SecurityContext): Promise<{ allowed: boolean; reason?: string }> {
    const key = `discord:${context.userId}:${context.command || context.action || 'general'}`;
    const configName = this.getRateLimitConfig(context);
    
    const result = rateLimiter.isRateLimited(key, configName);
    
    if (result.limited) {
      await auditLogger.log(
        context.userId,
        context.guildId,
        AuditActions.RATE_LIMIT_EXCEEDED,
        AuditCategories.SECURITY,
        { 
          command: context.command,
          retryAfter: result.retryAfter 
        }
      );
      
      return { 
        allowed: false, 
        reason: result.message || 'You are being rate limited. Please try again later.' 
      };
    }
    
    return { allowed: true };
  }

  /**
   * Get rate limit config based on context
   */
  private getRateLimitConfig(context: SecurityContext): string {
    if (context.command) {
      // Special rate limits for certain commands
      const heavyCommands = ['backup', 'restore', 'migrate'];
      if (heavyCommands.includes(context.command)) {
        return 'heavy';
      }
      
      const economyCommands = ['daily', 'work', 'rob', 'gamble'];
      if (economyCommands.includes(context.command)) {
        return 'economy';
      }
      
      const adminCommands = ['config', 'setup', 'permissions'];
      if (adminCommands.includes(context.command)) {
        return 'admin';
      }
    }
    
    return 'default';
  }

  /**
   * Check permissions
   */
  private async checkPermissions(
    interaction: ChatInputCommandInteraction
  ): Promise<{ allowed: boolean; reason?: string }> {
    const member = interaction.member as GuildMember;
    const commandPermissions = permissions.constructor.getCommandPermissions();
    const requiredPermission = commandPermissions[interaction.commandName];
    
    if (requiredPermission) {
      const hasPermission = await permissions.hasPermission(member, requiredPermission);
      
      if (!hasPermission) {
        await auditLogger.log(
          member.id,
          interaction.guildId!,
          'permission_denied',
          AuditCategories.SECURITY,
          { 
            command: interaction.commandName,
            permission: requiredPermission 
          }
        );
        
        return { 
          allowed: false, 
          reason: 'You do not have permission to use this command.' 
        };
      }
    }
    
    return { allowed: true };
  }

  /**
   * Validate inputs
   */
  private async validateInputs(
    interaction: ChatInputCommandInteraction | ModalSubmitInteraction
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (interaction.isChatInputCommand()) {
      // Validate command options
      for (const option of interaction.options.data) {
        const value = option.value?.toString();
        if (value && InputValidator.containsSQLInjection(value)) {
          await auditLogger.log(
            interaction.user.id,
            interaction.guildId!,
            AuditActions.SUSPICIOUS_ACTIVITY,
            AuditCategories.SECURITY,
            { 
              command: interaction.commandName,
              option: option.name,
              value: value.slice(0, 100) 
            }
          );
          
          return { 
            allowed: false, 
            reason: 'Invalid input detected. Please try again with valid input.' 
          };
        }
      }
    } else if (interaction.isModalSubmit()) {
      // Validate modal fields
      for (const field of interaction.fields.fields.values()) {
        if (InputValidator.containsSQLInjection(field.value)) {
          await auditLogger.log(
            interaction.user.id,
            interaction.guildId!,
            AuditActions.SUSPICIOUS_ACTIVITY,
            AuditCategories.SECURITY,
            { 
              modal: interaction.customId,
              field: field.customId,
              value: field.value.slice(0, 100) 
            }
          );
          
          return { 
            allowed: false, 
            reason: 'Invalid input detected. Please try again with valid input.' 
          };
        }
      }
    }
    
    return { allowed: true };
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkSuspiciousActivity(
    context: SecurityContext
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check for rapid command switching (potential bot/automation)
    const recentCommands = await this.getRecentCommands(context.userId, context.guildId);
    
    if (recentCommands.length >= 10) {
      const uniqueCommands = new Set(recentCommands);
      if (uniqueCommands.size >= 8) {
        // User is rapidly switching between many different commands
        await auditLogger.log(
          context.userId,
          context.guildId,
          AuditActions.SUSPICIOUS_ACTIVITY,
          AuditCategories.SECURITY,
          { 
            reason: 'Rapid command switching detected',
            commands: Array.from(uniqueCommands) 
          }
        );
        
        // Add to temporary blacklist
        rateLimiter.addToBlacklist(`discord:${context.userId}:*`, 600000); // 10 minutes
        
        return { 
          allowed: false, 
          reason: 'Suspicious activity detected. Please try again later.' 
        };
      }
    }
    
    return { allowed: true };
  }

  /**
   * Get recent commands from audit log
   */
  private async getRecentCommands(userId: string, guildId: string): Promise<string[]> {
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    
    const entries = await auditLogger.query({
      userId,
      guildId,
      action: 'command_executed',
      startDate: fiveMinutesAgo
    }, 20);
    
    return entries
      .map(entry => entry.details.command)
      .filter(Boolean);
  }

  /**
   * Sanitize user input for safe display
   */
  static sanitizeForDisplay(input: string): string {
    return InputValidator.sanitizeText(input);
  }

  /**
   * Sanitize user input for database queries
   */
  static sanitizeForDatabase(input: string): string {
    return input
      .replace(/'/g, "''") // Escape single quotes
      .replace(/\\/g, '\\\\') // Escape backslashes
      .trim();
  }

  /**
   * Check if a URL is safe
   */
  static isSafeURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
      ];
      
      return !suspiciousPatterns.some(pattern => pattern.test(url));
    } catch {
      return false;
    }
  }
}

// Global security middleware instance
export const security = new SecurityMiddleware();