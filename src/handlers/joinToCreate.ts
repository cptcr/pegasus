import { VoiceState, ChannelType, CategoryChannel, VoiceChannel, PermissionFlagsBits } from 'discord.js';
import { db } from '../database/connection';
import { limits } from '../utils/config';

export class JoinToCreateHandler {
  private static instance: JoinToCreateHandler;
  private tempChannels = new Map<string, NodeJS.Timeout>();

  public static getInstance(): JoinToCreateHandler {
    if (!JoinToCreateHandler.instance) {
      JoinToCreateHandler.instance = new JoinToCreateHandler();
    }
    return JoinToCreateHandler.instance;
  }

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (!newState.guild) return;

    const settings = await this.getGuildSettings(newState.guild.id);
    if (!settings.join_to_create_channel) return;

    if (newState.channelId === settings.join_to_create_channel && newState.member) {
      await this.createTempChannel(newState);
    }

    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      await this.handleChannelLeave(oldState);
    }
  }

  private async createTempChannel(voiceState: VoiceState): Promise<void> {
    if (!voiceState.guild || !voiceState.member) return;

    const settings = await this.getGuildSettings(voiceState.guild.id);
    if (!settings.join_to_create_category) return;

    const category = voiceState.guild.channels.cache.get(settings.join_to_create_category) as CategoryChannel;
    if (!category) return;

    const existingChannels = await db.query(
      'SELECT COUNT(*) as count FROM temp_channels WHERE guild_id = $1 AND owner_id = $2',
      [voiceState.guild.id, voiceState.member.id]
    );

    if (existingChannels.rows[0].count >= limits.maxTempChannels) {
      try {
        await voiceState.member.send('❌ You have reached the maximum number of temporary channels.');
      } catch (error) {
        console.log('Could not send DM to user about temp channel limit');
      }
      return;
    }

    try {
      const tempChannel = await voiceState.guild.channels.create({
        name: `${voiceState.member.displayName}'s Channel`,
        type: ChannelType.GuildVoice,
        parent: category,
        permissionOverwrites: [
          {
            id: voiceState.member.id,
            allow: [
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.MuteMembers,
              PermissionFlagsBits.DeafenMembers,
            ],
          },
          {
            id: voiceState.guild.roles.everyone,
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
          },
        ],
      });

      await voiceState.setChannel(tempChannel);

      await db.query(
        'INSERT INTO temp_channels (guild_id, channel_id, owner_id, parent_id) VALUES ($1, $2, $3, $4)',
        [voiceState.guild.id, tempChannel.id, voiceState.member.id, category.id]
      );

      this.scheduleChannelDeletion(tempChannel.id);

    } catch (error) {
      console.error('Error creating temp channel:', error);
    }
  }

  private async handleChannelLeave(voiceState: VoiceState): Promise<void> {
    if (!voiceState.guild || !voiceState.channelId) return;

    const tempChannelData = await db.query(
      'SELECT * FROM temp_channels WHERE channel_id = $1',
      [voiceState.channelId]
    );

    if (tempChannelData.rows.length === 0) return;

    const channel = voiceState.guild.channels.cache.get(voiceState.channelId) as VoiceChannel;
    if (!channel) return;

    if (channel.members.size === 0) {
      await this.deleteTempChannel(voiceState.channelId);
    }
  }

  private async deleteTempChannel(channelId: string): Promise<void> {
    try {
      const tempChannelData = await db.query(
        'SELECT * FROM temp_channels WHERE channel_id = $1',
        [channelId]
      );

      if (tempChannelData.rows.length === 0) return;

      const channel = tempChannelData.rows[0];
      const guild = global.client?.guilds.cache.get(channel.guild_id);
      if (!guild) return;

      const voiceChannel = guild.channels.cache.get(channelId);
      if (voiceChannel) {
        await voiceChannel.delete('Temporary channel cleanup');
      }

      await db.query('DELETE FROM temp_channels WHERE channel_id = $1', [channelId]);

      const timeout = this.tempChannels.get(channelId);
      if (timeout) {
        clearTimeout(timeout);
        this.tempChannels.delete(channelId);
      }

    } catch (error) {
      console.error('Error deleting temp channel:', error);
    }
  }

  private scheduleChannelDeletion(channelId: string): void {
    const timeout = setTimeout(() => {
      this.deleteTempChannel(channelId);
    }, limits.autoDeleteTempChannels);

    this.tempChannels.set(channelId, timeout);
  }

  public async setJoinToCreateChannel(guildId: string, channelId: string | null): Promise<void> {
    await db.query(
      `INSERT INTO guild_settings (guild_id, join_to_create_channel) VALUES ($1, $2)
       ON CONFLICT (guild_id) DO UPDATE SET join_to_create_channel = $2`,
      [guildId, channelId]
    );
  }

  public async setJoinToCreateCategory(guildId: string, categoryId: string | null): Promise<void> {
    await db.query(
      `INSERT INTO guild_settings (guild_id, join_to_create_category) VALUES ($1, $2)
       ON CONFLICT (guild_id) DO UPDATE SET join_to_create_category = $2`,
      [guildId, categoryId]
    );
  }

  public async getTempChannels(guildId: string): Promise<any[]> {
    const result = await db.query(
      'SELECT * FROM temp_channels WHERE guild_id = $1',
      [guildId]
    );

    return result.rows;
  }

  public async deleteTempChannelById(channelId: string): Promise<boolean> {
    const result = await db.query(
      'SELECT * FROM temp_channels WHERE channel_id = $1',
      [channelId]
    );

    if (result.rows.length === 0) return false;

    await this.deleteTempChannel(channelId);
    return true;
  }

  public async transferOwnership(channelId: string, newOwnerId: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE temp_channels SET owner_id = $1 WHERE channel_id = $2',
      [newOwnerId, channelId]
    );

    return result.rowCount > 0;
  }

  private async getGuildSettings(guildId: string): Promise<any> {
    const result = await db.query(
      'SELECT join_to_create_channel, join_to_create_category FROM guild_settings WHERE guild_id = $1',
      [guildId]
    );

    if (result.rows.length === 0) {
      await db.query(
        'INSERT INTO guild_settings (guild_id) VALUES ($1)',
        [guildId]
      );

      return {
        join_to_create_channel: null,
        join_to_create_category: null,
      };
    }

    return result.rows[0];
  }

  public async cleanupOldChannels(): Promise<void> {
    const result = await db.query(
      'SELECT * FROM temp_channels WHERE created_at < NOW() - INTERVAL \'1 hour\'',
      []
    );

    for (const channel of result.rows) {
      await this.deleteTempChannel(channel.channel_id);
    }
  }
}

export const joinToCreateHandler = JoinToCreateHandler.getInstance();