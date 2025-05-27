// src/modules/voice/Join2CreateManager.ts
import { ChannelType, Guild, GuildMember, PermissionsBitField, VoiceChannel, VoiceState } from 'discord.js';
import { ExtendedClient } from '@/index';
import { J2CSettings, J2CSettingsUpdate } from '@/types';

export class Join2CreateManager {
  private client: ExtendedClient;

  constructor(client: ExtendedClient) {
    this.client = client;
  }

  public async getSettings(guildId: string): Promise<J2CSettings | null> {
    return this.client.db.j2CSettings.findUnique({ where: { guildId } });
  }

  public async setupJoin2Create(guild: Guild, options: {
    categoryId: string;
    channelName: string;
    userLimit: number;
    bitrate: number;
  }): Promise<{ success: true; channel: VoiceChannel } | { success: false; error: string }> {
    try {
      const j2cChannel = await guild.channels.create({
        name: options.channelName,
        type: ChannelType.GuildVoice,
        parent: options.categoryId,
        userLimit: 1,
      });

      const settings: J2CSettings = {
        isEnabled: true,
        categoryId: options.categoryId,
        joinChannelId: j2cChannel.id,
        channelNameTemplate: "{user}'s Channel",
        defaultUserLimit: options.userLimit,
        defaultBitrate: options.bitrate,
        allowTextChannel: false,
        autoDeleteEmpty: true,
        lockEmptyChannels: false
      };

      await this.client.db.j2CSettings.upsert({
        where: { guildId: guild.id },
        update: settings,
        create: { guildId: guild.id, ...settings }
      });

      return { success: true, channel: j2cChannel };
    } catch (error) {
      this.client.logger.error("Failed to setup J2C:", error);
      return { success: false, error: "Could not create channel or save settings." };
    }
  }

  public async updateSettings(guildId: string, data: J2CSettingsUpdate): Promise<{ success: boolean; error?: string }> {
      try {
          await this.client.db.j2CSettings.update({ where: { guildId }, data });
          this.client.wsManager.emitRealtimeEvent(guildId, 'j2c:settings:updated', data);
          return { success: true };
      } catch (error) {
          this.client.logger.error(`Failed to update J2C settings for guild ${guildId}:`, error);
          return { success: false, error: "Database update failed." };
      }
  }

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const { guild } = newState;
    const settings = await this.getSettings(guild.id);
    if (!settings?.isEnabled || !settings.joinChannelId) return;

    // User joins the "Join to Create" channel
    if (newState.channelId === settings.joinChannelId) {
      if (!newState.member) return;
      this.createTempChannel(newState.member, settings);
    }

    // User leaves a temporary channel
    if (oldState.channelId && oldState.channelId !== settings.joinChannelId && oldState.channel.parent?.id === settings.categoryId) {
        if (oldState.channel.members.size === 0) {
            // This is a temp channel, check if it should be deleted
            const isTempChannel = await this.client.db.j2CSettings.findFirst({ where: { categoryId: oldState.channel.parent.id }});
            if (isTempChannel) {
                this.deleteEmptyTempChannel(oldState.channel as VoiceChannel, settings);
            }
        }
    }
  }
  
  private async createTempChannel(member: GuildMember, settings: J2CSettings): Promise<void> {
    if (!settings.categoryId) {
      this.client.logger.error(`No category set for J2C in guild ${member.guild.id}`);
      return;
    }

    try {
      const channelName = settings.channelNameTemplate
        .replace('{user}', member.displayName)
        .replace('{count}', (await this.getChannelCount(settings.categoryId) + 1).toString());

      const tempChannel = await member.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: settings.categoryId,
        userLimit: settings.defaultUserLimit,
        bitrate: settings.defaultBitrate,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.MoveMembers],
          },
          {
            id: member.guild.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
          }
        ],
      });

      await this.client.db.j2CChannel.create({
        data: {
          id: tempChannel.id,
          guildId: member.guild.id,
          ownerId: member.id,
          parentId: settings.categoryId
        }
      });

      await member.voice.setChannel(tempChannel).catch(error => {
        this.client.logger.error(`Failed to move member to temp channel:`, error);
      });

      this.client.wsManager.emitRealtimeEvent(member.guild.id, 'j2c:channel:created', {
        channelId: tempChannel.id,
        ownerId: member.id,
        name: channelName
      });
    } catch (error) {
      this.client.logger.error(`Failed to create temp channel for ${member.user.tag}:`, error);
    }
  }

  private async deleteEmptyTempChannel(channel: VoiceChannel, settings: J2CSettings): Promise<void> {
    if (!settings.autoDeleteEmpty) return;

    try {
      const isTempChannel = await this.client.db.j2CChannel.findUnique({
        where: { id: channel.id }
      });

      if (!isTempChannel) return;

      await channel.delete('Empty temporary channel');
      
      await this.client.db.j2CChannel.delete({
        where: { id: channel.id }
      });

      this.client.wsManager.emitRealtimeEvent(channel.guild.id, 'j2c:channel:deleted', {
        channelId: channel.id,
        reason: 'empty'
      });

      this.client.logger.debug(`Deleted empty temp channel ${channel.id}`);
    } catch (error) {
      this.client.logger.error(`Failed to delete temp channel ${channel.id}:`, error);
    }
  }

  private async getChannelCount(categoryId: string): Promise<number> {
    return this.client.db.j2CChannel.count({
      where: { parentId: categoryId }
    });
  }

  // Add missing methods for blacklist functionality
  public async getBlacklist(guildId: string): Promise<string[]> {
    const settings = await this.getSettings(guildId);
    return settings?.blacklistedUsers || [];
  }

  public async addToBlacklist(guildId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = await this.getSettings(guildId);
      if (!settings) return { success: false, error: "J2C not configured" };

      const blacklist = new Set(settings.blacklistedUsers || []);
      blacklist.add(userId);

      await this.updateSettings(guildId, { blacklistedUsers: Array.from(blacklist) });
      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to update blacklist" };
    }
  }

  public async removeFromBlacklist(guildId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = await this.getSettings(guildId);
      if (!settings) return { success: false, error: "J2C not configured" };

      const blacklist = new Set(settings.blacklistedUsers || []);
      blacklist.delete(userId);

      await this.updateSettings(guildId, { blacklistedUsers: Array.from(blacklist) });
      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to update blacklist" };
    }
  }

  // Add method to get active channels
  public async getActiveChannels(guildId: string): Promise<string[]> {
    const channels = await this.client.db.j2CChannel.findMany({
      where: { guildId }
    });
    return channels.map(c => c.id);
  }
}