// src/modules/voice/Join2CreateManager.ts
import { Guild, VoiceState, ChannelType, VoiceChannel, PermissionsBitField } from 'discord.js';
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

  public async setup(guild: Guild, categoryId: string, channelName: string, userLimit: number, bitrate: number): Promise<{ success: true; channel: VoiceChannel } | { success: false; error: string }> {
    try {
      const j2cChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        userLimit: 1,
      });

      const settings = {
        isEnabled: true,
        categoryId,
        joinChannelId: j2cChannel.id,
        defaultUserLimit: userLimit,
        defaultBitrate: bitrate,
      };

      await this.client.db.j2CSettings.upsert({
        where: { guildId: guild.id },
        update: settings,
        create: { guildId: guild.id, ...settings },
      });

      return { success: true, channel: j2cChannel };
    } catch (error) {
      this.client.logger.error("Failed to setup J2C:", error);
      return { success: false, error: "Could not create channel or save settings. Please check permissions." };
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
    const channelName = settings.channelNameTemplate.replace('{user}', member.displayName);
    try {
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
        ],
      });
      await member.voice.setChannel(tempChannel);
      this.client.wsManager.emitRealtimeEvent(member.guild.id, 'j2c:channel:created', { userId: member.id, channelId: tempChannel.id });
    } catch (error) {
      this.client.logger.error(`Failed to create temp channel for ${member.user.tag}:`, error);
    }
  }
  
  private async deleteEmptyTempChannel(channel: VoiceChannel, settings: J2CSettings): Promise<void> {
      if (!settings.autoDeleteEmpty) return;
      
      try {
          await channel.delete('Temporary channel empty');
          this.client.wsManager.emitRealtimeEvent(channel.guild.id, 'j2c:channel:deleted', { channelId: channel.id });
      } catch (error) {
          this.client.logger.error(`Failed to delete empty temp channel ${channel.id}:`, error);
      }
  }
}