import { 
  PermissionFlagsBits, 
  PermissionsBitField,
  GuildMember,
  Guild,
  ChatInputCommandInteraction,
  GuildChannel,
  Role
} from 'discord.js';
import { logger } from '../utils/logger';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  missingPermissions?: string[];
}

// Permission groups for easier management
export const PermissionGroups = {
  MODERATION_BASIC: [
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.ManageMessages,
  ],
  
  MODERATION_ADVANCED: [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
  ],
  
  MANAGEMENT: [
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.ManageGuildExpressions,
  ],
  
  DANGEROUS: [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageWebhooks,
  ],
};

export class PermissionManager {
  // Bot owner IDs (from environment variable)
  private static readonly BOT_OWNERS = (process.env.BOT_OWNERS || '').split(',').filter(Boolean);
  
  /**
   * Check if user is bot owner
   */
  static isBotOwner(userId: string): boolean {
    return this.BOT_OWNERS.includes(userId);
  }
  
  /**
   * Check if member has required permissions
   */
  static hasPermissions(
    member: GuildMember,
    permissions: bigint[],
    checkAdmin: boolean = true
  ): PermissionCheck {
    // Bot owners bypass all checks
    if (this.isBotOwner(member.id)) {
      return { allowed: true };
    }
    
    // Check for admin if enabled
    if (checkAdmin && member.permissions.has(PermissionFlagsBits.Administrator)) {
      return { allowed: true };
    }
    
    // Check specific permissions
    const missing: string[] = [];
    for (const permission of permissions) {
      if (!member.permissions.has(permission)) {
        const permName = this.getPermissionName(permission);
        missing.push(permName);
      }
    }
    
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: 'Missing required permissions',
        missingPermissions: missing,
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Check if member can moderate target
   */
  static canModerate(
    moderator: GuildMember,
    target: GuildMember,
    action: 'ban' | 'kick' | 'timeout' | 'warn' | 'role'
  ): PermissionCheck {
    // Bot owners can moderate anyone
    if (this.isBotOwner(moderator.id)) {
      return { allowed: true };
    }
    
    // Can't moderate yourself
    if (moderator.id === target.id) {
      return { allowed: false, reason: 'You cannot moderate yourself' };
    }
    
    // Can't moderate the guild owner
    if (target.id === target.guild.ownerId) {
      return { allowed: false, reason: 'Cannot moderate the guild owner' };
    }
    
    // Can't moderate bot owners
    if (this.isBotOwner(target.id)) {
      return { allowed: false, reason: 'Cannot moderate bot owners' };
    }
    
    // Check role hierarchy
    const moderatorHighest = moderator.roles.highest;
    const targetHighest = target.roles.highest;
    
    if (moderatorHighest.position <= targetHighest.position) {
      return { 
        allowed: false, 
        reason: 'Your highest role must be above the target\'s highest role' 
      };
    }
    
    // Check specific permissions for action
    const requiredPerms: bigint[] = [];
    switch (action) {
      case 'ban':
        requiredPerms.push(PermissionFlagsBits.BanMembers);
        break;
      case 'kick':
        requiredPerms.push(PermissionFlagsBits.KickMembers);
        break;
      case 'timeout':
        requiredPerms.push(PermissionFlagsBits.ModerateMembers);
        break;
      case 'warn':
        requiredPerms.push(PermissionFlagsBits.ModerateMembers);
        break;
      case 'role':
        requiredPerms.push(PermissionFlagsBits.ManageRoles);
        break;
    }
    
    return this.hasPermissions(moderator, requiredPerms);
  }
  
  /**
   * Check if bot has permissions in channel
   */
  static async checkBotPermissions(
    guild: Guild,
    channel?: GuildChannel | null,
    permissions: bigint[] = []
  ): Promise<PermissionCheck> {
    const botMember = guild.members.me;
    if (!botMember) {
      return { allowed: false, reason: 'Bot is not in the guild' };
    }
    
    // Check guild-level permissions
    const guildCheck = this.hasPermissions(botMember, permissions, true);
    if (!guildCheck.allowed) {
      return guildCheck;
    }
    
    // Check channel-level permissions if provided
    if (channel) {
      const channelPerms = channel.permissionsFor(botMember);
      if (!channelPerms) {
        return { allowed: false, reason: 'Cannot determine channel permissions' };
      }
      
      const missing: string[] = [];
      for (const permission of permissions) {
        if (!channelPerms.has(permission)) {
          const permName = this.getPermissionName(permission);
          missing.push(permName);
        }
      }
      
      if (missing.length > 0) {
        return {
          allowed: false,
          reason: 'Bot missing required channel permissions',
          missingPermissions: missing,
        };
      }
    }
    
    return { allowed: true };
  }
  
  /**
   * Check command permissions
   */
  static async checkCommandPermissions(
    interaction: ChatInputCommandInteraction,
    requiredPermissions: bigint[],
    options: {
      requireOwner?: boolean;
      requireAdmin?: boolean;
      customCheck?: (member: GuildMember) => Promise<boolean>;
    } = {}
  ): Promise<PermissionCheck> {
    if (!interaction.guild || !interaction.member) {
      return { allowed: false, reason: 'This command can only be used in a guild' };
    }
    
    const member = interaction.member as GuildMember;
    
    // Check owner requirement
    if (options.requireOwner && !this.isBotOwner(member.id)) {
      return { allowed: false, reason: 'This command is restricted to bot owners' };
    }
    
    // Check admin requirement
    if (options.requireAdmin && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return { allowed: false, reason: 'This command requires administrator permissions' };
    }
    
    // Check custom requirement
    if (options.customCheck) {
      try {
        const customAllowed = await options.customCheck(member);
        if (!customAllowed) {
          return { allowed: false, reason: 'You do not meet the requirements for this command' };
        }
      } catch (error) {
        logger.error('Custom permission check failed:', error);
        return { allowed: false, reason: 'Permission check failed' };
      }
    }
    
    // Check required permissions
    return this.hasPermissions(member, requiredPermissions);
  }
  
  /**
   * Get human-readable permission name
   */
  private static getPermissionName(permission: bigint): string {
    const permissionNames: Record<string, string> = {
      [PermissionFlagsBits.CreateInstantInvite.toString()]: 'Create Invite',
      [PermissionFlagsBits.KickMembers.toString()]: 'Kick Members',
      [PermissionFlagsBits.BanMembers.toString()]: 'Ban Members',
      [PermissionFlagsBits.Administrator.toString()]: 'Administrator',
      [PermissionFlagsBits.ManageChannels.toString()]: 'Manage Channels',
      [PermissionFlagsBits.ManageGuild.toString()]: 'Manage Server',
      [PermissionFlagsBits.AddReactions.toString()]: 'Add Reactions',
      [PermissionFlagsBits.ViewAuditLog.toString()]: 'View Audit Log',
      [PermissionFlagsBits.PrioritySpeaker.toString()]: 'Priority Speaker',
      [PermissionFlagsBits.Stream.toString()]: 'Video',
      [PermissionFlagsBits.ViewChannel.toString()]: 'View Channel',
      [PermissionFlagsBits.SendMessages.toString()]: 'Send Messages',
      [PermissionFlagsBits.SendTTSMessages.toString()]: 'Send TTS Messages',
      [PermissionFlagsBits.ManageMessages.toString()]: 'Manage Messages',
      [PermissionFlagsBits.EmbedLinks.toString()]: 'Embed Links',
      [PermissionFlagsBits.AttachFiles.toString()]: 'Attach Files',
      [PermissionFlagsBits.ReadMessageHistory.toString()]: 'Read Message History',
      [PermissionFlagsBits.MentionEveryone.toString()]: 'Mention Everyone',
      [PermissionFlagsBits.UseExternalEmojis.toString()]: 'Use External Emojis',
      [PermissionFlagsBits.ViewGuildInsights.toString()]: 'View Server Insights',
      [PermissionFlagsBits.Connect.toString()]: 'Connect',
      [PermissionFlagsBits.Speak.toString()]: 'Speak',
      [PermissionFlagsBits.MuteMembers.toString()]: 'Mute Members',
      [PermissionFlagsBits.DeafenMembers.toString()]: 'Deafen Members',
      [PermissionFlagsBits.MoveMembers.toString()]: 'Move Members',
      [PermissionFlagsBits.UseVAD.toString()]: 'Use Voice Activity',
      [PermissionFlagsBits.ChangeNickname.toString()]: 'Change Nickname',
      [PermissionFlagsBits.ManageNicknames.toString()]: 'Manage Nicknames',
      [PermissionFlagsBits.ManageRoles.toString()]: 'Manage Roles',
      [PermissionFlagsBits.ManageWebhooks.toString()]: 'Manage Webhooks',
      [PermissionFlagsBits.ManageGuildExpressions.toString()]: 'Manage Expressions',
      [PermissionFlagsBits.UseApplicationCommands.toString()]: 'Use Application Commands',
      [PermissionFlagsBits.RequestToSpeak.toString()]: 'Request to Speak',
      [PermissionFlagsBits.ManageEvents.toString()]: 'Manage Events',
      [PermissionFlagsBits.ManageThreads.toString()]: 'Manage Threads',
      [PermissionFlagsBits.CreatePublicThreads.toString()]: 'Create Public Threads',
      [PermissionFlagsBits.CreatePrivateThreads.toString()]: 'Create Private Threads',
      [PermissionFlagsBits.UseExternalStickers.toString()]: 'Use External Stickers',
      [PermissionFlagsBits.SendMessagesInThreads.toString()]: 'Send Messages in Threads',
      [PermissionFlagsBits.UseEmbeddedActivities.toString()]: 'Use Activities',
      [PermissionFlagsBits.ModerateMembers.toString()]: 'Timeout Members',
    };
    
    return permissionNames[permission.toString()] || 'Unknown Permission';
  }
  
  /**
   * Check if member has dangerous permissions
   */
  static hasDangerousPermissions(member: GuildMember): boolean {
    return PermissionGroups.DANGEROUS.some(perm => member.permissions.has(perm));
  }
  
  /**
   * Get effective permissions for a member in a channel
   */
  static getEffectivePermissions(
    member: GuildMember,
    channel: GuildChannel
  ): PermissionsBitField {
    return channel.permissionsFor(member) || new PermissionsBitField();
  }
  
  /**
   * Check rate limit bypass permission
   */
  static canBypassRateLimit(member: GuildMember): boolean {
    return this.isBotOwner(member.id) || 
           member.permissions.has(PermissionFlagsBits.Administrator) ||
           member.permissions.has(PermissionFlagsBits.ManageGuild);
  }
  
  /**
   * Validate role management
   */
  static canManageRole(member: GuildMember, role: Role): PermissionCheck {
    // Check basic permission
    if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return { 
        allowed: false, 
        reason: 'You need Manage Roles permission',
        missingPermissions: ['Manage Roles'] 
      };
    }
    
    // Check role hierarchy
    if (member.roles.highest.position <= role.position) {
      return { 
        allowed: false, 
        reason: 'You can only manage roles below your highest role' 
      };
    }
    
    // Check if role is managed by integration
    if (role.managed) {
      return { 
        allowed: false, 
        reason: 'This role is managed by an integration and cannot be manually assigned' 
      };
    }
    
    return { allowed: true };
  }
}