// src/modules/quarantine/QuarantineManager.ts - Fixed Quarantine System
import { 
  Guild, 
  GuildMember, 
  User, 
  Role, 
  EmbedBuilder, 
  TextChannel,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  VoiceChannel,
  NewsChannel,
  StageChannel,
  ButtonInteraction
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../../utils/Logger.js';
import { Config } from '../../config/Config.js';
import { ExtendedClient } from '../../index.js';

export interface QuarantineOptions {
  duration?: number;
  reason?: string;
  moderatorId: string;
  logChannel?: TextChannel;
  notifyUser?: boolean;
}

export interface QuarantineEntry {
  id: number;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  active: boolean;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class QuarantineManager {
  private client: ExtendedClient;
  private db: PrismaClient;
  private logger: typeof Logger;
  private activeTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(client: ExtendedClient, db: PrismaClient, logger: typeof Logger) {
    this.client = client;
    this.db = db;
    this.logger = logger;
    
    // Start timer for checking expired quarantines
    this.startExpirationTimer();
  }

  /**
   * Put a user in quarantine
   */
  async quarantineUser(
    guild: Guild,
    target: GuildMember | User,
    options: QuarantineOptions
  ): Promise<{ success: boolean; entry?: QuarantineEntry; error?: string }> {
    try {
      const member = target instanceof GuildMember ? target : await guild.members.fetch(target.id).catch(() => null);
      
      if (!member) {
        return { success: false, error: 'User not found in guild' };
      }

      // Check if user is already quarantined
      const existingEntry = await this.db.quarantine.findFirst({
        where: {
          guildId: guild.id,
          userId: member.id,
          active: true
        }
      });

      if (existingEntry) {
        return { success: false, error: 'User is already quarantined' };
      }

      // Get guild settings to find quarantine role
      const guildSettings = await this.db.guild.findUnique({
        where: { id: guild.id }
      });

      // Parse settings JSON to get quarantineRoleId
      let quarantineRoleId: string | null = null;
      if (guildSettings?.settings && typeof guildSettings.settings === 'object') {
        const settings = guildSettings.settings as any;
        quarantineRoleId = settings.quarantineRoleId || null;
      }

      if (!quarantineRoleId) {
        return { success: false, error: 'Quarantine role not configured. Use /quarantine setup first.' };
      }

      const quarantineRole = guild.roles.cache.get(quarantineRoleId);
      if (!quarantineRole) {
        return { success: false, error: 'Quarantine role not found' };
      }

      // Store user's current roles
      const userRoles = member.roles.cache
        .filter(role => role.id !== guild.id && role.id !== quarantineRole.id)
        .map(role => role.id);

      // Calculate expiration time
      const expiresAt = options.duration ? new Date(Date.now() + options.duration) : null;

      // Create quarantine entry
      const entry = await this.db.quarantine.create({
        data: {
          guildId: guild.id,
          userId: member.id,
          moderatorId: options.moderatorId,
          reason: options.reason || 'No reason provided',
          active: true,
          quarantinedAt: new Date()
        }
      });

      // Remove current roles and add quarantine role
      try {
        await member.roles.set([quarantineRole.id]);
        this.logger.info(`Applied quarantine role to ${member.user.tag} in ${guild.name}`);
      } catch (error) {
        this.logger.error('Failed to apply quarantine role:', error);
        // Delete the entry if role application failed
        await this.db.quarantine.delete({ where: { id: entry.id } });
        return { success: false, error: 'Failed to apply quarantine role' };
      }

      // Set expiration timer if duration is specified
      if (expiresAt) {
        this.setExpirationTimer(entry.id, expiresAt);
      }

      // Send notification to user if enabled
      if (options.notifyUser) {
        await this.notifyUser(member, options.reason || 'No reason provided', expiresAt);
      }

      // Log the action
      await this.logQuarantineAction(guild, 'QUARANTINE_ADD', member.user, options.moderatorId, options.reason, expiresAt);

      // Emit to dashboard
      this.client.wsManager.emitRealtimeEvent(guild.id, 'quarantine:added', {
        userId: member.id,
        username: member.user.tag,
        moderatorId: options.moderatorId,
        reason: options.reason,
        expiresAt: expiresAt?.toISOString()
      });

      this.logger.info(`User ${member.user.tag} quarantined in ${guild.name} by ${options.moderatorId}`);

      return { success: true, entry: entry as QuarantineEntry };
      
    } catch (error) {
      this.logger.error('Error quarantining user:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Remove user from quarantine
   */
  async unquarantineUser(
    guild: Guild,
    targetId: string,
    moderatorId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find active quarantine entry
      const entry = await this.db.quarantine.findFirst({
        where: {
          guildId: guild.id,
          userId: targetId,
          active: true
        }
      });

      if (!entry) {
        return { success: false, error: 'User is not quarantined' };
      }

      const member = await guild.members.fetch(targetId).catch(() => null);
      if (!member) {
        // User left the guild, just mark as inactive
        await this.db.quarantine.update({
          where: { id: entry.id },
          data: { active: false, updatedAt: new Date() }
        });
        return { success: true };
      }

      // Get guild settings
      const guildSettings = await this.db.guild.findUnique({
        where: { id: guild.id }
      });

      let quarantineRoleId: string | null = null;
      if (guildSettings?.settings && typeof guildSettings.settings === 'object') {
        const settings = guildSettings.settings as any;
        quarantineRoleId = settings.quarantineRoleId || null;
      }

      const quarantineRole = quarantineRoleId ? 
        guild.roles.cache.get(quarantineRoleId) : null;

      // Remove quarantine role and restore basic member role
      try {
        const everyoneRole = guild.roles.everyone;
        await member.roles.set([everyoneRole.id]);
        this.logger.info(`Removed quarantine role from ${member.user.tag} in ${guild.name}`);
      } catch (error) {
        this.logger.error('Failed to restore roles:', error);
      }

      // Mark quarantine as inactive
      await this.db.quarantine.update({
        where: { id: entry.id },
        data: { active: false, updatedAt: new Date() }
      });

      // Clear expiration timer
      if (this.activeTimers.has(entry.id)) {
        clearTimeout(this.activeTimers.get(entry.id)!);
        this.activeTimers.delete(entry.id);
      }

      // Log the action
      await this.logQuarantineAction(guild, 'QUARANTINE_REMOVE', member.user, moderatorId, reason);

      // Emit to dashboard
      this.client.wsManager.emitRealtimeEvent(guild.id, 'quarantine:removed', {
        userId: targetId,
        username: member.user.tag,
        moderatorId: moderatorId,
        reason: reason
      });

      this.logger.info(`User ${member.user.tag} unquarantined in ${guild.name} by ${moderatorId}`);

      return { success: true };
      
    } catch (error) {
      this.logger.error('Error unquarantining user:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Get quarantine status for a user
   */
  async getQuarantineStatus(guildId: string, userId: string): Promise<QuarantineEntry | null> {
    try {
      const entry = await this.db.quarantine.findFirst({
        where: {
          guildId,
          userId,
          active: true
        }
      });

      return entry as QuarantineEntry | null;
    } catch (error) {
      this.logger.error('Error getting quarantine status:', error);
      return null;
    }
  }

  /**
   * Get quarantine history for a user
   */
  async getQuarantineHistory(guildId: string, userId: string, limit = 10): Promise<QuarantineEntry[]> {
    try {
      const entries = await this.db.quarantine.findMany({
        where: {
          guildId,
          userId
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return entries as QuarantineEntry[];
    } catch (error) {
      this.logger.error('Error getting quarantine history:', error);
      return [];
    }
  }

  /**
   * Get all active quarantines for a guild
   */
  async getActiveQuarantines(guildId: string): Promise<QuarantineEntry[]> {
    try {
      const entries = await this.db.quarantine.findMany({
        where: {
          guildId,
          active: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return entries as QuarantineEntry[];
    } catch (error) {
      this.logger.error('Error getting active quarantines:', error);
      return [];
    }
  }

  /**
   * Setup quarantine role with proper permissions
   */
  async setupQuarantineRole(guild: Guild): Promise<{ success: boolean; role?: Role; error?: string }> {
    try {
      // Create quarantine role
      const role = await guild.roles.create({
        name: 'Quarantined',
        color: Config.COLORS.QUARANTINE,
        permissions: new PermissionsBitField([]), // No permissions
        reason: 'Quarantine system setup'
      });

      // Update channel permissions to restrict quarantined users
      const channels = guild.channels.cache.filter(c => (c.isTextBased() || c.isVoiceBased()) && !c.isThread());
      
      for (const [, channel] of channels) {
        try {
          await (channel as TextChannel | VoiceChannel | NewsChannel | StageChannel).permissionOverwrites.create(role, {
            SendMessages: false,
            AddReactions: false,
            Speak: false,
            Stream: false,
            UseVAD: false,
            Connect: false
          });
        } catch (error) {
          this.logger.warn(`Failed to set permissions for channel ${channel.name}:`, error);
        }
      }

      // Update guild settings
      await this.db.guild.upsert({
        where: { id: guild.id },
        update: { 
          settings: {
            quarantineRoleId: role.id
          }
        },
        create: {
          id: guild.id,
          name: guild.name,
          settings: {
            quarantineRoleId: role.id
          }
        }
      });

      this.logger.info(`Created quarantine role for guild ${guild.name}`);
      return { success: true, role };
      
    } catch (error) {
      this.logger.error('Error setting up quarantine role:', error);
      return { success: false, error: 'Failed to create quarantine role' };
    }
  }

  /**
   * Handle button interactions for quarantine controls
   */
  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      if (!interaction.guild) return;

      // Parse custom ID: format is "quarantine:action:userId"
      const [prefix, action, userId] = interaction.customId.split(':');
      
      if (prefix !== 'quarantine') {
        return;
      }

      // Check if user has moderation permissions
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
        await interaction.reply({ content: 'You do not have permission to use this button.', ephemeral: true });
        return;
      }

      switch (action) {
        case 'remove':
          const result = await this.unquarantineUser(interaction.guild, userId, interaction.user.id, 'Removed via button');
          if (result.success) {
            await interaction.reply({ content: `✅ User has been removed from quarantine.`, ephemeral: true });
          } else {
            await interaction.reply({ content: `❌ Failed to remove quarantine: ${result.error}`, ephemeral: true });
          }
          break;
        
        default:
          await interaction.reply({ content: 'Unknown quarantine action.', ephemeral: true });
          break;
      }

    } catch (error) {
      this.logger.error('Error handling quarantine button interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing this action.', 
          ephemeral: true 
        });
      }
    }
  }

  /**
   * Set expiration timer for quarantine entry
   */
  private setExpirationTimer(entryId: number, expiresAt: Date): void {
    const delay = expiresAt.getTime() - Date.now();
    
    if (delay <= 0) {
      // Already expired, process immediately
      this.processExpiredQuarantine(entryId);
      return;
    }

    const timer = setTimeout(() => {
      this.processExpiredQuarantine(entryId);
    }, delay);

    this.activeTimers.set(entryId, timer);
  }

  /**
   * Process expired quarantine entry
   */
  private async processExpiredQuarantine(entryId: number): Promise<void> {
    try {
      const entry = await this.db.quarantine.findUnique({
        where: { id: entryId }
      });

      if (!entry || !entry.active) {
        return;
      }

      const guild = this.client.guilds.cache.get(entry.guildId);
      if (!guild) {
        // Guild not found, mark as inactive
        await this.db.quarantine.update({
          where: { id: entryId },
          data: { active: false }
        });
        return;
      }

      await this.unquarantineUser(guild, entry.userId, 'SYSTEM', 'Quarantine expired');
      
    } catch (error) {
      this.logger.error('Error processing expired quarantine:', error);
    }
  }

  /**
   * Start timer to check for expired quarantines
   */
  private startExpirationTimer(): void {
    setInterval(async () => {
      try {
        // Note: We need to add expiresAt field to the schema for this to work properly
        // For now, we'll use a placeholder check
        const activeEntries = await this.db.quarantine.findMany({
          where: {
            active: true
          }
        });

        // This is a placeholder - in a real implementation you'd check expiresAt
        // For now, we'll just ensure no entries are stuck
        for (const entry of activeEntries) {
          // Check if quarantine has been active for more than the maximum duration
          const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days
          if (Date.now() - entry.createdAt.getTime() > maxDuration) {
            await this.processExpiredQuarantine(entry.id);
          }
        }
      } catch (error) {
        this.logger.error('Error checking expired quarantines:', error);
      }
    }, Config.QUARANTINE.CHECK_INTERVAL);
  }

  /**
   * Notify user about quarantine
   */
  private async notifyUser(member: GuildMember, reason: string, expiresAt?: Date | null): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.QUARANTINE} You have been quarantined`)
        .setDescription(`You have been placed in quarantine in **${member.guild.name}**.`)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { 
            name: 'Duration', 
            value: expiresAt ? `Until <t:${Math.floor(expiresAt.getTime() / 1000)}:F>` : 'Indefinite', 
            inline: true 
          }
        )
        .setColor(Config.COLORS.QUARANTINE)
        .setTimestamp();

      await member.send({ embeds: [embed] });
    } catch (error) {
      this.logger.warn('Failed to notify user about quarantine:', error);
    }
  }

  /**
   * Log quarantine action
   */
  private async logQuarantineAction(
    guild: Guild,
    action: 'QUARANTINE_ADD' | 'QUARANTINE_REMOVE',
    target: User,
    moderatorId: string,
    reason?: string,
    expiresAt?: Date | null
  ): Promise<void> {
    try {
      const guildSettings = await this.db.guild.findUnique({
        where: { id: guild.id }
      });

      let modLogChannelId: string | null = null;
      if (guildSettings?.settings && typeof guildSettings.settings === 'object') {
        const settings = guildSettings.settings as any;
        modLogChannelId = settings.modLogChannelId || null;
      }

      if (!modLogChannelId) {
        return;
      }

      const logChannel = guild.channels.cache.get(modLogChannelId) as TextChannel;
      if (!logChannel) {
        return;
      }

      const moderator = await this.client.users.fetch(moderatorId).catch(() => null);
      
      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.QUARANTINE} Quarantine ${action === 'QUARANTINE_ADD' ? 'Added' : 'Removed'}`)
        .addFields(
          { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Moderator', value: moderator ? `${moderator.tag} (${moderator.id})` : moderatorId, inline: true }
        )
        .setColor(action === 'QUARANTINE_ADD' ? Config.COLORS.ERROR : Config.COLORS.SUCCESS)
        .setTimestamp();

      if (reason) {
        embed.addFields({ name: 'Reason', value: reason });
      }

      if (action === 'QUARANTINE_ADD' && expiresAt) {
        embed.addFields({ 
          name: 'Expires', 
          value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` 
        });
      }

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`quarantine:${action === 'QUARANTINE_ADD' ? 'remove' : 'add'}:${target.id}`)
            .setLabel(action === 'QUARANTINE_ADD' ? 'Remove Quarantine' : 'Add Quarantine')
            .setStyle(action === 'QUARANTINE_ADD' ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(action === 'QUARANTINE_ADD' ? Config.EMOJIS.UNLOCK : Config.EMOJIS.LOCK)
        );

      await logChannel.send({ embeds: [embed], components: [row] });
      
    } catch (error) {
      this.logger.error('Error logging quarantine action:', error);
    }
  }

  /**
   * Clean up expired timers and inactive entries
   */
  async cleanup(): Promise<void> {
    try {
      // Clear all active timers
      for (const [entryId, timer] of this.activeTimers) {
        clearTimeout(timer);
      }
      this.activeTimers.clear();

      // Clean up old inactive entries (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      await this.db.quarantine.deleteMany({
        where: {
          active: false,
          updatedAt: {
            lt: thirtyDaysAgo
          }
        }
      });

      this.logger.info('Quarantine system cleanup completed');
      
    } catch (error) {
      this.logger.error('Error during quarantine cleanup:', error);
    }
  }

  /**
   * Initialize quarantine system for guild
   */
  async initializeGuild(guild: Guild): Promise<void> {
    try {
      // Load active quarantines - note: this is simplified since we don't have expiresAt field yet
      const activeEntries = await this.db.quarantine.findMany({
        where: {
          guildId: guild.id,
          active: true
        }
      });

      // For now, we just log the count since we can't set expiration timers without expiresAt field
      this.logger.info(`Initialized quarantine system for guild ${guild.name} with ${activeEntries.length} active entries`);
      
    } catch (error) {
      this.logger.error('Error initializing quarantine system for guild:', error);
    }
  }
}