// src/modules/voice/Join2CreateManager.ts
import { 
  Guild, 
  VoiceState, 
  ChannelType, 
  VoiceChannel, 
  PermissionsBitField, 
  GuildMember,
  ButtonInteraction,
  CategoryChannel,
  TextChannel
} from 'discord.js';
import { PrismaClient, J2CSettings } from '@prisma/client';
import { ExtendedClient } from '../../index.js';
import { Logger } from '../../utils/Logger.js';

export interface J2CSettingsUpdate {
  isEnabled?: boolean;
  categoryId?: string;
  joinChannelId?: string;
  channelNameTemplate?: string;
  defaultUserLimit?: number;
  defaultBitrate?: number;
  allowTextChannel?: boolean;
  autoDeleteEmpty?: boolean;
  lockEmptyChannels?: boolean;
  blacklistUserIds?: string[];
}

export class Join2CreateManager {
  private client: ExtendedClient;
  private db: PrismaClient;
  private logger: Logger;

  constructor(client: ExtendedClient, db: PrismaClient, logger: Logger) {
    this.client = client;
    this.db = db;
    this.logger = logger;
  }

  /**
   * Get J2C settings for a guild
   */
  public async getSettings(guildId: string): Promise<J2CSettings | null> {
    try {
      return await this.db.j2CSettings.findUnique({ where: { guildId } });
    } catch (error) {
      this.logger.error('Error getting J2C settings:', error);
      return null;
    }
  }

  /**
   * Setup Join to Create system
   */
  public async setupJoin2Create(
    guild: Guild, 
    options: {
      categoryId: string;
      channelName: string;
      userLimit: number;
      bitrate: number;
    }
  ): Promise<{ success: true; channel: VoiceChannel } | { success: false; error: string }> {
    try {
      const category = guild.channels.cache.get(options.categoryId) as CategoryChannel;
      if (!category || category.type !== ChannelType.GuildCategory) {
        return { success: false, error: 'Invalid category provided' };
      }

      const j2cChannel = await guild.channels.create({
        name: options.channelName,
        type: ChannelType.GuildVoice,
        parent: options.categoryId,
        userLimit: 1,
        bitrate: options.bitrate,
      });

      const settings = {
        isEnabled: true,
        categoryId: options.categoryId,
        joinChannelId: j2cChannel.id,
        channelNameTemplate: '{user}\'s Channel',
        defaultUserLimit: options.userLimit,
        defaultBitrate: options.bitrate,
        autoDeleteEmpty: true,
        lockEmptyChannels: false,
        allowTextChannel: false,
        blacklistUserIds: [],
      };

      await this.db.j2CSettings.upsert({
        where: { guildId: guild.id },
        update: settings,
        create: { guildId: guild.id, ...settings },
      });

      this.logger.info(`J2C system setup for guild ${guild.name}`);
      return { success: true, channel: j2cChannel };
    } catch (error) {
      this.logger.error("Failed to setup J2C:", error);
      return { success: false, error: "Could not create channel or save settings. Please check permissions." };
    }
  }

  /**
   * Disable Join to Create system
   */
  public async disableJoin2Create(guildId: string): Promise<{ success: boolean; error?: string; cleanedChannels?: number }> {
    try {
      const settings = await this.getSettings(guildId);
      if (!settings) {
        return { success: false, error: 'J2C not configured for this guild' };
      }

      // Clean up temporary channels
      const cleanedChannels = await this.cleanupChannels(guildId);

      // Delete join channel if it exists
      const guild = this.client.guilds.cache.get(guildId);
      if (guild && settings.joinChannelId) {
        const joinChannel = guild.channels.cache.get(settings.joinChannelId);
        if (joinChannel) {
          await joinChannel.delete('J2C system disabled');
        }
      }

      // Disable in database
      await this.db.j2CSettings.update({
        where: { guildId },
        data: { isEnabled: false }
      });

      this.logger.info(`J2C system disabled for guild ${guildId}`);
      return { success: true, cleanedChannels: cleanedChannels.cleanedChannels };
    } catch (error) {
      this.logger.error('Error disabling J2C:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Update J2C settings
   */
  public async updateSettings(guildId: string, data: J2CSettingsUpdate): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db.j2CSettings.update({ 
        where: { guildId }, 
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
      
      this.client.wsManager.emitRealtimeEvent(guildId, 'j2c:settings:updated', data);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update J2C settings for guild ${guildId}:`, error);
      return { success: false, error: "Database update failed." };
    }
  }

  /**
   * Handle voice state updates
   */
  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const { guild } = newState;
    if (!guild) return;

    const settings = await this.getSettings(guild.id);
    if (!settings?.isEnabled || !settings.joinChannelId) return;

    // User joins the "Join to Create" channel
    if (newState.channelId === settings.joinChannelId && newState.member) {
      await this.createTempChannel(newState.member, settings);
    }

    // User leaves a temporary channel
    if (oldState.channelId && 
        oldState.channelId !== settings.joinChannelId && 
        oldState.channel?.parent?.id === settings.categoryId &&
        oldState.channel.members.size === 0) {
      await this.deleteEmptyTempChannel(oldState.channel as VoiceChannel, settings);
    }
  }

  /**
   * Create temporary voice channel
   */
  private async createTempChannel(member: GuildMember, settings: J2CSettings): Promise<void> {
    try {
      // Check if user is blacklisted
      if (settings.blacklistUserIds.includes(member.id)) {
        return;
      }

      const channelName = settings.channelNameTemplate.replace('{user}', member.displayName);
      
      const tempChannel = await member.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: settings.categoryId,
        userLimit: settings.defaultUserLimit,
        bitrate: settings.defaultBitrate,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ManageChannels, 
              PermissionsBitField.Flags.MoveMembers,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak
            ],
          },
        ],
      });

      // Create text channel if enabled
      let textChannel: TextChannel | undefined;
      if (settings.allowTextChannel) {
        textChannel = await member.guild.channels.create({
          name: `${channelName}-chat`,
          type: ChannelType.GuildText,
          parent: settings.categoryId,
          permissionOverwrites: [
            {
              id: member.guild.roles.everyone,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: member.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            }
          ]
        });
      }

      await member.voice.setChannel(tempChannel);
      
      this.client.wsManager.emitRealtimeEvent(
        member.guild.id, 
        'j2c:channel:created', 
        { 
          userId: member.id, 
          channelId: tempChannel.id,
          textChannelId: textChannel?.id 
        }
      );

      this.logger.debug(`Created temp channel for ${member.user.tag}: ${tempChannel.name}`);
    } catch (error) {
      this.logger.error(`Failed to create temp channel for ${member.user.tag}:`, error);
    }
  }

  /**
   * Delete empty temporary channel
   */
  private async deleteEmptyTempChannel(channel: VoiceChannel, settings: J2CSettings): Promise<void> {
    if (!settings.autoDeleteEmpty) return;
    
    try {
      // Find and delete associated text channel if it exists
      if (settings.allowTextChannel) {
        const textChannelName = `${channel.name}-chat`;
        const textChannel = channel.guild.channels.cache.find(
          c => c.name === textChannelName && c.parent?.id === settings.categoryId
        );
        if (textChannel) {
          await textChannel.delete('Associated temp channel deleted');
        }
      }

      await channel.delete('Temporary channel empty');
      
      this.client.wsManager.emitRealtimeEvent(
        channel.guild.id, 
        'j2c:channel:deleted', 
        { channelId: channel.id }
      );

      this.logger.debug(`Deleted empty temp channel: ${channel.name}`);
    } catch (error) {
      this.logger.error(`Failed to delete empty temp channel ${channel.id}:`, error);
    }
  }

  /**
   * Add user to blacklist
   */
  public async addToBlacklist(guildId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = await this.getSettings(guildId);
      if (!settings) {
        return { success: false, error: 'J2C not configured for this guild' };
      }

      if (settings.blacklistUserIds.includes(userId)) {
        return { success: false, error: 'User is already blacklisted' };
      }

      const updatedBlacklist = [...settings.blacklistUserIds, userId];
      
      await this.db.j2CSettings.update({
        where: { guildId },
        data: { blacklistUserIds: updatedBlacklist }
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error adding user to blacklist:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Remove user from blacklist
   */
  public async removeFromBlacklist(guildId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = await this.getSettings(guildId);
      if (!settings) {
        return { success: false, error: 'J2C not configured for this guild' };
      }

      if (!settings.blacklistUserIds.includes(userId)) {
        return { success: false, error: 'User is not blacklisted' };
      }

      const updatedBlacklist = settings.blacklistUserIds.filter(id => id !== userId);
      
      await this.db.j2CSettings.update({
        where: { guildId },
        data: { blacklistUserIds: updatedBlacklist }
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error removing user from blacklist:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Get blacklisted users
   */
  public async getBlacklist(guildId: string): Promise<string[]> {
    try {
      const settings = await this.getSettings(guildId);
      return settings?.blacklistUserIds || [];
    } catch (error) {
      this.logger.error('Error getting blacklist:', error);
      return [];
    }
  }

  /**
   * Get active temporary channels
   */
  public async getActiveChannels(guildId: string): Promise<VoiceChannel[]> {
    try {
      const settings = await this.getSettings(guildId);
      if (!settings?.categoryId) return [];

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return [];

      const category = guild.channels.cache.get(settings.categoryId) as CategoryChannel;
      if (!category) return [];

      return category.children.cache
        .filter(channel => 
          channel.type === ChannelType.GuildVoice && 
          channel.id !== settings.joinChannelId
        )
        .map(channel => channel as VoiceChannel)
        .toArray();
    } catch (error) {
      this.logger.error('Error getting active channels:', error);
      return [];
    }
  }

  /**
   * Cleanup temporary channels
   */
  public async cleanupChannels(guildId: string): Promise<{ success: boolean; error?: string; cleanedChannels?: number }> {
    try {
      const activeChannels = await this.getActiveChannels(guildId);
      let cleanedCount = 0;

      for (const channel of activeChannels) {
        if (channel.members.size === 0) {
          try {
            await channel.delete('J2C cleanup');
            cleanedCount++;
          } catch (error) {
            this.logger.warn(`Failed to delete channel ${channel.id}:`, error);
          }
        }
      }

      return { success: true, cleanedChannels: cleanedCount };
    } catch (error) {
      this.logger.error('Error cleaning up channels:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Handle button interactions for J2C controls
   */
  public async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    // This can be implemented for channel owner controls
    // like rename, limit, lock, etc.
    await interaction.reply({ 
      content: 'J2C button interactions not yet implemented.', 
      ephemeral: true 
    });
  }
}