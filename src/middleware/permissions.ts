import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  Role,
  Guild,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
} from 'discord.js';
import { logger } from '../utils/logger';

// ===========================
// PERMISSION CONFIGURATIONS
// ===========================

export interface PermissionRequirement {
  permissions?: bigint[];           // Required Discord permissions
  roles?: string[];                 // Required role IDs
  users?: string[];                 // Allowed user IDs
  channels?: string[];              // Allowed channel IDs
  categories?: string[];            // Allowed category IDs
  customCheck?: (interaction: ChatInputCommandInteraction) => Promise<boolean>;
  requireAll?: boolean;             // Require all permissions vs any
  allowOwner?: boolean;             // Always allow bot owner
  allowAdmin?: boolean;             // Always allow administrators
  denyBots?: boolean;              // Deny bot users
  requireHierarchy?: boolean;       // Check role hierarchy
  minAccountAge?: number;           // Minimum account age in days
  minServerAge?: number;            // Minimum time in server in days
  requiredBoosts?: number;          // Required server boost level
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  missingPermissions?: string[];
  missingRoles?: string[];
  failedChecks?: string[];
}

// Pre-defined permission sets
export const PermissionPresets = {
  // Owner only
  OWNER_ONLY: {
    users: [process.env.BOT_OWNER_ID!].filter(Boolean),
    allowOwner: true,
  } as PermissionRequirement,
  
  // Admin only
  ADMIN_ONLY: {
    permissions: [PermissionFlagsBits.Administrator],
    allowOwner: true,
    allowAdmin: true,
  } as PermissionRequirement,
  
  // Moderator permissions
  MODERATOR: {
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ModerateMembers,
    ],
    requireAll: false,
    allowAdmin: true,
  } as PermissionRequirement,
  
  // Server manager
  SERVER_MANAGER: {
    permissions: [
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles,
    ],
    requireAll: false,
    allowAdmin: true,
  } as PermissionRequirement,
  
  // Member management
  MEMBER_MANAGER: {
    permissions: [
      PermissionFlagsBits.ManageNicknames,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.KickMembers,
    ],
    requireAll: false,
    allowAdmin: true,
  } as PermissionRequirement,
  
  // Channel management
  CHANNEL_MANAGER: {
    permissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageWebhooks,
    ],
    requireAll: false,
    allowAdmin: true,
  } as PermissionRequirement,
  
  // Voice permissions
  VOICE_MANAGER: {
    permissions: [
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.MuteMembers,
      PermissionFlagsBits.DeafenMembers,
    ],
    requireAll: false,
    allowAdmin: true,
  } as PermissionRequirement,
  
  // Basic user
  BASIC_USER: {
    permissions: [PermissionFlagsBits.SendMessages],
    denyBots: true,
  } as PermissionRequirement,
  
  // Premium user
  PREMIUM_USER: {
    requiredBoosts: 1,
    denyBots: true,
  } as PermissionRequirement,
  
  // Trusted user (30 days in server)
  TRUSTED_USER: {
    minServerAge: 30,
    minAccountAge: 30,
    denyBots: true,
  } as PermissionRequirement,
};

// ===========================
// PERMISSION CHECKER CLASS
// ===========================

export class PermissionChecker {
  private static botOwners: Set<string> = new Set(
    (process.env.BOT_OWNERS || process.env.BOT_OWNER_ID || '')
      .split(',')
      .filter(Boolean)
  );
  
  /**
   * Main permission check function
   */
  static async check(
    interaction: ChatInputCommandInteraction,
    requirements: PermissionRequirement
  ): Promise<PermissionCheckResult> {
    const member = interaction.member as GuildMember;
    const guild = interaction.guild!;
    
    // Check if bot owner (super admin)
    if (requirements.allowOwner !== false && this.isBotOwner(interaction.user.id)) {
      return { allowed: true };
    }
    
    // Check if user is a bot
    if (requirements.denyBots && interaction.user.bot) {
      return {
        allowed: false,
        reason: 'Bots are not allowed to use this command',
      };
    }
    
    // Check if guild admin (if allowed)
    if (requirements.allowAdmin && member.permissions.has(PermissionFlagsBits.Administrator)) {
      return { allowed: true };
    }
    
    // Check specific users
    if (requirements.users && requirements.users.length > 0) {
      if (!requirements.users.includes(interaction.user.id)) {
        return {
          allowed: false,
          reason: 'You are not authorized to use this command',
        };
      }
    }
    
    // Check channels
    if (requirements.channels && requirements.channels.length > 0) {
      if (!requirements.channels.includes(interaction.channelId)) {
        return {
          allowed: false,
          reason: 'This command cannot be used in this channel',
        };
      }
    }
    
    // Check categories
    if (requirements.categories && requirements.categories.length > 0) {
      const channel = interaction.channel as TextChannel | VoiceChannel;
      if (!channel.parentId || !requirements.categories.includes(channel.parentId)) {
        return {
          allowed: false,
          reason: 'This command cannot be used in this category',
        };
      }
    }
    
    // Check Discord permissions
    if (requirements.permissions && requirements.permissions.length > 0) {
      const missingPerms = this.checkPermissions(member, requirements.permissions, requirements.requireAll);
      if (missingPerms.length > 0) {
        return {
          allowed: false,
          reason: 'You lack the required permissions',
          missingPermissions: missingPerms,
        };
      }
    }
    
    // Check roles
    if (requirements.roles && requirements.roles.length > 0) {
      const missingRoles = this.checkRoles(member, requirements.roles);
      if (missingRoles.length > 0) {
        return {
          allowed: false,
          reason: 'You lack the required roles',
          missingRoles: missingRoles,
        };
      }
    }
    
    // Check account age
    if (requirements.minAccountAge) {
      const accountAge = (Date.now() - interaction.user.createdTimestamp) / 86400000;
      if (accountAge < requirements.minAccountAge) {
        return {
          allowed: false,
          reason: `Your account must be at least ${requirements.minAccountAge} days old`,
        };
      }
    }
    
    // Check server membership duration
    if (requirements.minServerAge) {
      const serverAge = (Date.now() - member.joinedTimestamp!) / 86400000;
      if (serverAge < requirements.minServerAge) {
        return {
          allowed: false,
          reason: `You must be in this server for at least ${requirements.minServerAge} days`,
        };
      }
    }
    
    // Check server boost level
    if (requirements.requiredBoosts) {
      if (guild.premiumTier < requirements.requiredBoosts) {
        return {
          allowed: false,
          reason: `This server needs to be boost level ${requirements.requiredBoosts}`,
        };
      }
    }
    
    // Check role hierarchy
    if (requirements.requireHierarchy) {
      const targetUser = interaction.options.getUser('user') || interaction.options.getUser('target');
      if (targetUser) {
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
        if (targetMember) {
          if (!this.checkHierarchy(member, targetMember)) {
            return {
              allowed: false,
              reason: 'You cannot perform this action on someone with a higher or equal role',
            };
          }
        }
      }
    }
    
    // Run custom check
    if (requirements.customCheck) {
      try {
        const customResult = await requirements.customCheck(interaction);
        if (!customResult) {
          return {
            allowed: false,
            reason: 'Custom permission check failed',
          };
        }
      } catch (error) {
        logger.error('Custom permission check error:', error);
        return {
          allowed: false,
          reason: 'Permission check failed',
        };
      }
    }
    
    return { allowed: true };
  }
  
  /**
   * Check if user is bot owner
   */
  static isBotOwner(userId: string): boolean {
    return this.botOwners.has(userId);
  }
  
  /**
   * Check Discord permissions
   */
  private static checkPermissions(
    member: GuildMember,
    required: bigint[],
    requireAll = true
  ): string[] {
    const missing: string[] = [];
    const memberPerms = member.permissions.bitfield;
    
    for (const perm of required) {
      if ((memberPerms & perm) !== perm) {
        missing.push(this.getPermissionName(perm));
      }
    }
    
    if (requireAll) {
      return missing;
    } else {
      // If not requiring all, only return missing if ALL are missing
      return missing.length === required.length ? missing : [];
    }
  }
  
  /**
   * Check role requirements
   */
  private static checkRoles(member: GuildMember, required: string[]): string[] {
    const missing: string[] = [];
    
    for (const roleId of required) {
      if (!member.roles.cache.has(roleId)) {
        const role = member.guild.roles.cache.get(roleId);
        missing.push(role?.name || roleId);
      }
    }
    
    return missing;
  }
  
  /**
   * Check role hierarchy
   */
  private static checkHierarchy(executor: GuildMember, target: GuildMember): boolean {
    // Bot owner can always act
    if (this.isBotOwner(executor.id)) {
      return true;
    }
    
    // Can't act on bot owner
    if (this.isBotOwner(target.id)) {
      return false;
    }
    
    // Guild owner can act on anyone
    if (executor.id === executor.guild.ownerId) {
      return true;
    }
    
    // Can't act on guild owner
    if (target.id === target.guild.ownerId) {
      return false;
    }
    
    // Compare highest roles
    const executorHighest = executor.roles.highest;
    const targetHighest = target.roles.highest;
    
    return executorHighest.comparePositionTo(targetHighest) > 0;
  }
  
  /**
   * Get permission name from bitfield
   */
  private static getPermissionName(permission: bigint): string {
    const perms: Record<string, string> = {
      [PermissionFlagsBits.Administrator.toString()]: 'Administrator',
      [PermissionFlagsBits.ManageGuild.toString()]: 'Manage Server',
      [PermissionFlagsBits.ManageRoles.toString()]: 'Manage Roles',
      [PermissionFlagsBits.ManageChannels.toString()]: 'Manage Channels',
      [PermissionFlagsBits.KickMembers.toString()]: 'Kick Members',
      [PermissionFlagsBits.BanMembers.toString()]: 'Ban Members',
      [PermissionFlagsBits.ManageMessages.toString()]: 'Manage Messages',
      [PermissionFlagsBits.ManageWebhooks.toString()]: 'Manage Webhooks',
      [PermissionFlagsBits.ManageNicknames.toString()]: 'Manage Nicknames',
      [PermissionFlagsBits.ModerateMembers.toString()]: 'Timeout Members',
      [PermissionFlagsBits.MoveMembers.toString()]: 'Move Members',
      [PermissionFlagsBits.MuteMembers.toString()]: 'Mute Members',
      [PermissionFlagsBits.DeafenMembers.toString()]: 'Deafen Members',
    };
    
    return perms[permission.toString()] || 'Unknown Permission';
  }
  
  /**
   * Check if member can act on target role
   */
  static canManageRole(member: GuildMember, role: Role): boolean {
    // Bot owner can manage any role
    if (this.isBotOwner(member.id)) {
      return true;
    }
    
    // Guild owner can manage any role
    if (member.id === member.guild.ownerId) {
      return true;
    }
    
    // Must have manage roles permission
    if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return false;
    }
    
    // Check role hierarchy
    return member.roles.highest.comparePositionTo(role) > 0;
  }
  
  /**
   * Check if member can act in channel
   */
  static canActInChannel(
    member: GuildMember,
    channel: TextChannel | VoiceChannel,
    permission: bigint
  ): boolean {
    // Bot owner can act anywhere
    if (this.isBotOwner(member.id)) {
      return true;
    }
    
    // Check channel-specific permissions
    const perms = channel.permissionsFor(member);
    return perms ? perms.has(permission) : false;
  }
  
  /**
   * Create a permission requirement from command options
   */
  static createRequirement(options: {
    ownerOnly?: boolean;
    adminOnly?: boolean;
    modOnly?: boolean;
    permissions?: bigint[];
    roles?: string[];
    users?: string[];
    trusted?: boolean;
    premium?: boolean;
  }): PermissionRequirement {
    const requirement: PermissionRequirement = {
      allowOwner: true,
      denyBots: true,
    };
    
    if (options.ownerOnly) {
      return PermissionPresets.OWNER_ONLY;
    }
    
    if (options.adminOnly) {
      return PermissionPresets.ADMIN_ONLY;
    }
    
    if (options.modOnly) {
      return PermissionPresets.MODERATOR;
    }
    
    if (options.permissions) {
      requirement.permissions = options.permissions;
      requirement.allowAdmin = true;
    }
    
    if (options.roles) {
      requirement.roles = options.roles;
    }
    
    if (options.users) {
      requirement.users = options.users;
    }
    
    if (options.trusted) {
      requirement.minServerAge = 30;
      requirement.minAccountAge = 30;
    }
    
    if (options.premium) {
      requirement.requiredBoosts = 1;
    }
    
    return requirement;
  }
}

// ===========================
// PERMISSION MIDDLEWARE
// ===========================

export async function checkPermissions(
  interaction: ChatInputCommandInteraction,
  requirements: PermissionRequirement | string
): Promise<PermissionCheckResult> {
  // Handle preset strings
  if (typeof requirements === 'string') {
    const preset = PermissionPresets[requirements as keyof typeof PermissionPresets];
    if (!preset) {
      logger.error(`Unknown permission preset: ${requirements}`);
      return {
        allowed: false,
        reason: 'Invalid permission configuration',
      };
    }
    requirements = preset;
  }
  
  try {
    const result = await PermissionChecker.check(interaction, requirements);
    
    // Log denied attempts
    if (!result.allowed) {
      logger.debug(
        `Permission denied for ${interaction.user.tag} (${interaction.user.id}) ` +
        `in ${interaction.guild?.name} (${interaction.guildId}) ` +
        `for command ${interaction.commandName}: ${result.reason}`
      );
    }
    
    return result;
  } catch (error) {
    logger.error('Permission check error:', error);
    return {
      allowed: false,
      reason: 'Permission check failed',
    };
  }
}

// ===========================
// DYNAMIC PERMISSION SYSTEM
// ===========================

export class DynamicPermissions {
  private static customPermissions: Map<string, PermissionRequirement> = new Map();
  
  /**
   * Register custom permission set
   */
  static register(name: string, requirements: PermissionRequirement): void {
    this.customPermissions.set(name, requirements);
    logger.debug(`Registered custom permission set: ${name}`);
  }
  
  /**
   * Get custom permission set
   */
  static get(name: string): PermissionRequirement | undefined {
    return this.customPermissions.get(name);
  }
  
  /**
   * Check custom permission
   */
  static async check(
    name: string,
    interaction: ChatInputCommandInteraction
  ): Promise<PermissionCheckResult> {
    const requirements = this.customPermissions.get(name);
    
    if (!requirements) {
      return {
        allowed: false,
        reason: `Unknown permission set: ${name}`,
      };
    }
    
    return PermissionChecker.check(interaction, requirements);
  }
}

// Export singleton instance
export const permissionChecker = new PermissionChecker();
export default PermissionChecker;