import {
  ChatInputCommandInteraction,
  Message,
  GuildMember,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { checkCommandRateLimit, RateLimitResult } from './rateLimiter';
import { PermissionManager, PermissionCheck } from './permissions';
import { Validator, CommandSchemas, ValidationError } from './validator';
import { Sanitizer } from './sanitizer';
import { auditLogger } from './audit';
import { logger } from '../utils/logger';
import { t } from '../i18n';
import type { Command } from '../types/command';

export interface SecurityContext {
  userId: string;
  guildId: string;
  channelId: string;
  commandName: string;
  timestamp: number;
  isOwner: boolean;
  permissions: bigint;
}

export interface SecurityCheckResult {
  passed: boolean;
  error?: string;
  code?: 'RATE_LIMIT' | 'PERMISSION' | 'VALIDATION' | 'BLACKLIST' | 'MAINTENANCE';
  details?: any;
}

/**
 * Main security middleware for commands
 */
export async function securityMiddleware(
  interaction: ChatInputCommandInteraction,
  command: Command
): Promise<SecurityCheckResult> {
  const context: SecurityContext = {
    userId: interaction.user.id,
    guildId: interaction.guildId!,
    channelId: interaction.channelId,
    commandName: `${command.data.name}`,
    timestamp: Date.now(),
    isOwner: PermissionManager.isBotOwner(interaction.user.id),
    permissions: (interaction.member as GuildMember)?.permissions.bitfield || 0n,
  };

  try {
    // 1. Check maintenance mode
    if (process.env.MAINTENANCE_MODE === 'true' && !context.isOwner) {
      return {
        passed: false,
        error: t('security.maintenance'),
        code: 'MAINTENANCE',
      };
    }

    // 2. Check blacklist
    const blacklistCheck = await checkBlacklist(context);
    if (!blacklistCheck.passed) {
      return blacklistCheck;
    }

    // 3. Check rate limits
    const rateLimitCheck = await checkRateLimit(context);
    if (!rateLimitCheck.passed) {
      await handleRateLimit(interaction, rateLimitCheck.details as RateLimitResult);
      return rateLimitCheck;
    }

    // 4. Check permissions
    if (command.permissions && command.permissions.length > 0) {
      // Convert PermissionResolvable[] to bigint[]
      const permissionBits = command.permissions.map(p => {
        if (typeof p === 'bigint') return p;
        if (typeof p === 'string') {
          // Handle string permissions - convert to bigint if it's a valid bigint string
          try {
            return BigInt(p);
          } catch {
            // If it's not a valid bigint string, it might be a permission name
            // For now, return 0n as a fallback
            return 0n;
          }
        }
        if (typeof p === 'number') return BigInt(p);
        // Handle arrays or other types
        return 0n;
      });
      const permissionCheck = await PermissionManager.checkCommandPermissions(
        interaction,
        permissionBits
      );

      if (!permissionCheck.allowed) {
        await handlePermissionDenied(interaction, permissionCheck);
        return {
          passed: false,
          error: permissionCheck.reason,
          code: 'PERMISSION',
          details: permissionCheck,
        };
      }
    }

    // 5. Validate input
    const validationCheck = await validateCommandInput(interaction, command);
    if (!validationCheck.passed) {
      await handleValidationError(interaction, validationCheck.error!);
      return validationCheck;
    }

    // 6. Log command execution
    await auditLogger.logAction({
      action: 'COMMAND_EXECUTE',
      userId: context.userId,
      guildId: context.guildId,
      targetId: context.channelId,
      details: {
        command: context.commandName,
        options: sanitizeOptions([...interaction.options.data]),
      },
    });

    return { passed: true };
  } catch (error) {
    logger.error('Security middleware error:', error);
    return {
      passed: false,
      error: t('security.error'),
      code: 'VALIDATION',
    };
  }
}

/**
 * Check if user/guild is blacklisted
 */
async function checkBlacklist(context: SecurityContext): Promise<SecurityCheckResult> {
  // Check user blacklist
  const userBlacklisted = await isBlacklisted('user', context.userId);
  if (userBlacklisted) {
    return {
      passed: false,
      error: t('security.blacklisted.user'),
      code: 'BLACKLIST',
    };
  }

  // Check guild blacklist
  const guildBlacklisted = await isBlacklisted('guild', context.guildId);
  if (guildBlacklisted) {
    return {
      passed: false,
      error: t('security.blacklisted.guild'),
      code: 'BLACKLIST',
    };
  }

  return { passed: true };
}

/**
 * Check rate limits
 */
async function checkRateLimit(context: SecurityContext): Promise<SecurityCheckResult> {
  // Owners bypass rate limits
  if (context.isOwner) {
    return { passed: true };
  }

  // Check if user has rate limit bypass permission
  if (
    (context.permissions & PermissionFlagsBits.Administrator) ===
    PermissionFlagsBits.Administrator
  ) {
    return { passed: true };
  }

  const result = await checkCommandRateLimit(context.userId, context.guildId, context.commandName);

  if (!result.allowed) {
    return {
      passed: false,
      error: t('security.rateLimit', {
        seconds: Math.ceil(result.msBeforeNext / 1000),
      }),
      code: 'RATE_LIMIT',
      details: result,
    };
  }

  return { passed: true };
}

/**
 * Validate command input
 */
async function validateCommandInput(
  interaction: ChatInputCommandInteraction,
  command: Command
): Promise<SecurityCheckResult> {
  const commandName = command.data.name;
  const subcommand = interaction.options.getSubcommand(false);
  const subcommandGroup = interaction.options.getSubcommandGroup(false);

  // Get validation schema
  let schema = null;
  if (subcommandGroup && subcommand) {
    schema = (CommandSchemas as any)[commandName]?.[subcommandGroup]?.[subcommand];
  } else if (subcommand) {
    schema = (CommandSchemas as any)[commandName]?.[subcommand];
  } else {
    schema = (CommandSchemas as any)[commandName]?.['default'];
  }
  
  if (!schema) {
    return { passed: true }; // No schema defined, skip validation
  }

  try {
    // Extract options
    const options: Record<string, any> = {};
    
    // Navigate through the command structure
    let targetOptions = interaction.options.data;
    
    // If there's a subcommand group, navigate to it
    if (subcommandGroup) {
      const group = targetOptions.find(opt => opt.name === subcommandGroup && opt.type === 2);
      if (group?.options) {
        targetOptions = group.options;
      }
    }
    
    // If there's a subcommand, navigate to it
    if (subcommand) {
      const sub = targetOptions.find(opt => opt.name === subcommand && opt.type === 1);
      if (sub?.options) {
        targetOptions = sub.options;
      }
    }
    
    // Now extract the actual option values
    targetOptions.forEach(opt => {
      // Map user option to userId for validation
      if (opt.name === 'user' && commandName === 'warn') {
        options['userId'] = opt.value;
      } else if (opt.name === 'user' && (commandName === 'moderation' || commandName === 'blacklist')) {
        options['userId'] = opt.value;
      } else {
        options[opt.name] = opt.value;
      }
    });

    // Validate
    Validator.validate(schema, options);

    // Additional security checks
    await performSecurityChecks(options);

    return { passed: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        passed: false,
        error: error.message,
        code: 'VALIDATION',
      };
    }
    throw error;
  }
}

/**
 * Perform additional security checks on input
 */
async function performSecurityChecks(options: Record<string, any>): Promise<void> {
  for (const [_key, value] of Object.entries(options)) {
    if (typeof value === 'string') {
      // Check for mass mentions
      if (Sanitizer.hasMassMentions(value)) {
        throw new ValidationError('Mass mentions are not allowed');
      }

      // Check for spam patterns
      if (value.length > 100 && Sanitizer.isSpam(value)) {
        throw new ValidationError('Message appears to be spam');
      }

      // Check URLs if present
      const urlMatch = value.match(/https?:\/\/[^\s]+/gi);
      if (urlMatch) {
        for (const url of urlMatch) {
          if (!Validator.isUrlSafe(url)) {
            throw new ValidationError('Unsafe URL detected');
          }
        }
      }
    }
  }
}

/**
 * Handle rate limit response
 */
async function handleRateLimit(
  interaction: ChatInputCommandInteraction,
  result: RateLimitResult
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Rate Limit')
    .setDescription(t('security.rateLimit.description'))
    .addFields(
      {
        name: 'Time Remaining',
        value: `${Math.ceil(result.msBeforeNext / 1000)} seconds`,
        inline: true,
      },
      {
        name: 'Status',
        value: result.isBlocked ? 'Temporarily Blocked' : 'Rate Limited',
        inline: true,
      }
    )
    .setFooter({ text: 'Please slow down and try again later' })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

/**
 * Handle permission denied response
 */
async function handlePermissionDenied(
  interaction: ChatInputCommandInteraction,
  check: PermissionCheck
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Permission Denied')
    .setDescription(check.reason || t('security.permission.denied'))
    .setTimestamp();

  if (check.missingPermissions && check.missingPermissions.length > 0) {
    embed.addFields({
      name: 'Missing Permissions',
      value: check.missingPermissions.join(', '),
      inline: false,
    });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

/**
 * Handle validation error response
 */
async function handleValidationError(
  interaction: ChatInputCommandInteraction,
  error: string
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Invalid Input')
    .setDescription(error)
    .setFooter({ text: 'Please check your input and try again' })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

/**
 * Sanitize options for logging
 */
function sanitizeOptions(options: any[]): any[] {
  return options.map(opt => ({
    name: opt.name,
    type: opt.type,
    value: typeof opt.value === 'string' ? Sanitizer.removeSensitive(opt.value) : opt.value,
    options: opt.options ? sanitizeOptions(opt.options) : undefined,
  }));
}

/**
 * Check if entity is blacklisted (implement based on your database)
 */
async function isBlacklisted(_type: 'user' | 'guild', _id: string): Promise<boolean> {
  // TODO: Implement database check
  // For now, return false
  return false;
}

/**
 * Message security middleware
 */
export async function messageSecurityMiddleware(message: Message): Promise<SecurityCheckResult> {
  // Skip bot messages
  if (message.author.bot) {
    return { passed: true };
  }

  // Skip DMs for now
  if (!message.guild) {
    return { passed: true };
  }

  const content = message.content;

  // Check for spam
  if (Sanitizer.isSpam(content)) {
    await message.delete().catch(() => {});
    return {
      passed: false,
      error: 'Message detected as spam',
      code: 'VALIDATION',
    };
  }

  // Check for mass mentions
  if (Sanitizer.hasMassMentions(content)) {
    await message.delete().catch(() => {});
    await message.member?.timeout(300000, 'Mass mention spam').catch(() => {});
    return {
      passed: false,
      error: 'Mass mentions detected',
      code: 'VALIDATION',
    };
  }

  return { passed: true };
}

/**
 * Create security report embed
 */
export function createSecurityReport(
  title: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: string,
  actions?: string[]
): EmbedBuilder {
  const colors = {
    low: 0x00ff00,
    medium: 0xffff00,
    high: 0xffa500,
    critical: 0xff0000,
  };

  const embed = new EmbedBuilder()
    .setColor(colors[severity])
    .setTitle(`Security Alert: ${title}`)
    .setDescription(details)
    .addFields({
      name: 'Severity',
      value: severity.toUpperCase(),
      inline: true,
    })
    .setTimestamp();

  if (actions && actions.length > 0) {
    embed.addFields({
      name: 'Recommended Actions',
      value: actions.map((a, i) => `${i + 1}. ${a}`).join('\n'),
      inline: false,
    });
  }

  return embed;
}
