import { 
  Guild, 
  GuildMember, 
  User, 
  TextChannel, 
  VoiceChannel, 
  Role, 
  Message,
  AuditLogEvent,
  EmbedBuilder,
  VoiceState,
  ChannelType
} from 'discord.js';
import { db } from '../database/connection';
import { createEmbed } from '../utils/helpers';
import { colors, emojis } from '../utils/config';

export type LogCategory = 
  | 'moderation' 
  | 'message' 
  | 'member' 
  | 'voice' 
  | 'channel' 
  | 'role' 
  | 'server' 
  | 'automod'
  | 'economy'
  | 'tickets'
  | 'giveaways';

export class LoggingHandler {
  private static instance: LoggingHandler;

  public static getInstance(): LoggingHandler {
    if (!LoggingHandler.instance) {
      LoggingHandler.instance = new LoggingHandler();
    }
    return LoggingHandler.instance;
  }

  private async getLogChannel(guildId: string, category: LogCategory): Promise<TextChannel | null> {
    // First check for category-specific channel
    const categoryChannel = await db.query(
      'SELECT channel_id FROM log_channels WHERE guild_id = $1 AND category = $2 AND enabled = true',
      [guildId, category]
    );

    if (categoryChannel.rows[0]?.channel_id) {
      const guild = global.client?.guilds.cache.get(guildId);
      if (!guild) return null;

      const channel = guild.channels.cache.get(categoryChannel.rows[0].channel_id);
      if (channel?.isTextBased()) return channel as TextChannel;
    }

    // Fallback to general log channel
    const settings = await db.query(
      'SELECT log_channel FROM guild_settings WHERE guild_id = $1',
      [guildId]
    );

    if (!settings.rows[0]?.log_channel) return null;

    const guild = global.client?.guilds.cache.get(guildId);
    if (!guild) return null;

    const channel = guild.channels.cache.get(settings.rows[0].log_channel);
    return channel?.isTextBased() ? channel as TextChannel : null;
  }

  public async setLogChannel(guildId: string, category: LogCategory, channelId: string): Promise<boolean> {
    try {
      await db.query(
        `INSERT INTO log_channels (guild_id, category, channel_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, category)
         DO UPDATE SET channel_id = $3, enabled = true, updated_at = CURRENT_TIMESTAMP`,
        [guildId, category, channelId]
      );
      return true;
    } catch (error) {
      console.error('Error setting log channel:', error);
      return false;
    }
  }

  public async disableLogCategory(guildId: string, category: LogCategory): Promise<boolean> {
    try {
      await db.query(
        'UPDATE log_channels SET enabled = false, updated_at = CURRENT_TIMESTAMP WHERE guild_id = $1 AND category = $2',
        [guildId, category]
      );
      return true;
    } catch (error) {
      console.error('Error disabling log category:', error);
      return false;
    }
  }

  public async setGeneralLogChannel(guildId: string, channelId: string | null): Promise<boolean> {
    try {
      await db.query(
        `INSERT INTO guild_settings (guild_id, log_channel) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET log_channel = $2`,
        [guildId, channelId]
      );
      return true;
    } catch (error) {
      console.error('Error setting general log channel:', error);
      return false;
    }
  }

  public async getLogChannels(guildId: string): Promise<Array<{ category: LogCategory; channelId: string; enabled: boolean }>> {
    try {
      const result = await db.query(
        'SELECT category, channel_id, enabled FROM log_channels WHERE guild_id = $1',
        [guildId]
      );

      return result.rows.map((row: any) => ({
        category: row.category as LogCategory,
        channelId: row.channel_id,
        enabled: row.enabled
      }));
    } catch (error) {
      console.error('Error getting log channels:', error);
      return [];
    }
  }

  private async logEvent(guildId: string, type: string, data: any, userId?: string, channelId?: string, roleId?: string): Promise<void> {
    try {
      await db.query(
        'INSERT INTO log_events (guild_id, type, user_id, channel_id, role_id, data) VALUES ($1, $2, $3, $4, $5, $6)',
        [guildId, type, userId, channelId, roleId, data]
      );
    } catch (error) {
      console.error('Error logging event:', error);
    }
  }

  private async sendLogEmbed(guildId: string, category: LogCategory, embed: EmbedBuilder): Promise<void> {
    const logChannel = await this.getLogChannel(guildId, category);
    if (logChannel) {
      try {
        await logChannel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error sending log embed:', error);
      }
    }
  }

  // Member Events
  public async logMemberJoin(member: GuildMember): Promise<void> {
    const data = {
      userId: member.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      avatar: member.user.displayAvatarURL(),
      joinedAt: member.joinedAt,
      accountCreated: member.user.createdAt,
    };

    await this.logEvent(member.guild.id, 'member_join', data, member.id);

    const embed = createEmbed({
      title: `${emojis.success} Member Joined`,
      description: `${member.user.tag} has joined the server`,
      color: colors.success,
      thumbnail: member.user.displayAvatarURL(),
      fields: [
        {
          name: 'User',
          value: `${member.user.tag} (${member.id})`,
          inline: true,
        },
        {
          name: 'Account Created',
          value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`,
          inline: true,
        },
        {
          name: 'Member Count',
          value: member.guild.memberCount.toString(),
          inline: true,
        },
      ],
      timestamp: true,
    });

    await this.sendLogEmbed(member.guild.id, 'member', embed);
  }

  public async logMemberLeave(member: GuildMember): Promise<void> {
    const data = {
      userId: member.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      roles: member.roles.cache.map(r => r.id),
      joinedAt: member.joinedAt,
      leftAt: new Date(),
    };

    await this.logEvent(member.guild.id, 'member_leave', data, member.id);

    const embed = createEmbed({
      title: `${emojis.error} Member Left`,
      description: `${member.user.tag} has left the server`,
      color: colors.error,
      thumbnail: member.user.displayAvatarURL(),
      fields: [
        {
          name: 'User',
          value: `${member.user.tag} (${member.id})`,
          inline: true,
        },
        {
          name: 'Joined',
          value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown',
          inline: true,
        },
        {
          name: 'Member Count',
          value: member.guild.memberCount.toString(),
          inline: true,
        },
      ],
      timestamp: true,
    });

    await this.sendLogEmbed(member.guild.id, 'member', embed);
  }

  public async logMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    const changes: string[] = [];

    if (oldMember.nickname !== newMember.nickname) {
      changes.push(`Nickname: ${oldMember.nickname || 'None'} → ${newMember.nickname || 'None'}`);
    }

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

    if (addedRoles.size > 0) {
      changes.push(`Added roles: ${addedRoles.map(r => r.name).join(', ')}`);
    }

    if (removedRoles.size > 0) {
      changes.push(`Removed roles: ${removedRoles.map(r => r.name).join(', ')}`);
    }

    if (changes.length === 0) return;

    const data = {
      userId: newMember.id,
      changes,
      oldNickname: oldMember.nickname,
      newNickname: newMember.nickname,
      addedRoles: addedRoles.map(r => r.id),
      removedRoles: removedRoles.map(r => r.id),
    };

    await this.logEvent(newMember.guild.id, 'member_update', data, newMember.id);

    const embed = createEmbed({
      title: `${emojis.info} Member Updated`,
      description: `${newMember.user.tag} was updated`,
      color: colors.info,
      thumbnail: newMember.user.displayAvatarURL(),
      fields: [
        {
          name: 'User',
          value: `${newMember.user.tag} (${newMember.id})`,
          inline: true,
        },
        {
          name: 'Changes',
          value: changes.join('\n'),
          inline: false,
        },
      ],
      timestamp: true,
    });

    await this.sendLogEmbed(newMember.guild.id, 'member', embed);
  }

  // Message Events
  public async logMessageDelete(message: Message): Promise<void> {
    if (message.author.bot) return;

    const data = {
      messageId: message.id,
      content: message.content,
      authorId: message.author.id,
      channelId: message.channelId,
      attachments: message.attachments.map(a => ({ url: a.url, name: a.name })),
      embeds: message.embeds.length,
      createdAt: message.createdAt,
    };

    await this.logEvent(message.guild?.id || '', 'message_delete', data, message.author.id, message.channelId);

    const embed = createEmbed({
      title: `${emojis.error} Message Deleted`,
      description: `Message by ${message.author.tag} was deleted in ${message.channel}`,
      color: colors.error,
      fields: [
        {
          name: 'Author',
          value: `${message.author.tag} (${message.author.id})`,
          inline: true,
        },
        {
          name: 'Channel',
          value: `${message.channel} (${message.channelId})`,
          inline: true,
        },
        {
          name: 'Content',
          value: message.content || '*No content*',
          inline: false,
        },
      ],
      timestamp: true,
    });

    if (message.attachments.size > 0) {
      embed.addFields({
        name: 'Attachments',
        value: message.attachments.map(a => a.name).join(', '),
        inline: false,
      });
    }

    await this.sendLogEmbed(message.guild?.id || '', 'message', embed);
  }

  public async logMessageUpdate(oldMessage: Message, newMessage: Message): Promise<void> {
    if (newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const data = {
      messageId: newMessage.id,
      oldContent: oldMessage.content,
      newContent: newMessage.content,
      authorId: newMessage.author.id,
      channelId: newMessage.channelId,
      editedAt: newMessage.editedAt,
    };

    await this.logEvent(newMessage.guild?.id || '', 'message_update', data, newMessage.author.id, newMessage.channelId);

    const embed = createEmbed({
      title: `${emojis.info} Message Edited`,
      description: `Message by ${newMessage.author.tag} was edited in ${newMessage.channel}`,
      color: colors.info,
      fields: [
        {
          name: 'Author',
          value: `${newMessage.author.tag} (${newMessage.author.id})`,
          inline: true,
        },
        {
          name: 'Channel',
          value: `${newMessage.channel} (${newMessage.channelId})`,
          inline: true,
        },
        {
          name: 'Before',
          value: oldMessage.content || '*No content*',
          inline: false,
        },
        {
          name: 'After',
          value: newMessage.content || '*No content*',
          inline: false,
        },
      ],
      timestamp: true,
    });

    await this.sendLogEmbed(newMessage.guild?.id || '', 'message', embed);
  }

  // Voice Events
  public async logVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (!newState.member) return;

    const member = newState.member;
    let action = '';
    let color = colors.info;

    if (!oldState.channelId && newState.channelId) {
      action = 'joined';
      color = colors.success;
    } else if (oldState.channelId && !newState.channelId) {
      action = 'left';
      color = colors.error;
    } else if (oldState.channelId !== newState.channelId) {
      action = 'moved';
      color = colors.warning;
    } else {
      // State changes (mute, deafen, etc.)
      const changes: string[] = [];
      if (oldState.mute !== newState.mute) {
        changes.push(`${newState.mute ? 'Muted' : 'Unmuted'}`);
      }
      if (oldState.deaf !== newState.deaf) {
        changes.push(`${newState.deaf ? 'Deafened' : 'Undeafened'}`);
      }
      if (oldState.selfMute !== newState.selfMute) {
        changes.push(`${newState.selfMute ? 'Self-muted' : 'Self-unmuted'}`);
      }
      if (oldState.selfDeaf !== newState.selfDeaf) {
        changes.push(`${newState.selfDeaf ? 'Self-deafened' : 'Self-undeafened'}`);
      }
      
      if (changes.length === 0) return;
      action = changes.join(', ').toLowerCase();
    }

    const data = {
      userId: member.id,
      action,
      oldChannelId: oldState.channelId,
      newChannelId: newState.channelId,
      oldMute: oldState.mute,
      newMute: newState.mute,
      oldDeaf: oldState.deaf,
      newDeaf: newState.deaf,
    };

    await this.logEvent(newState.guild?.id || '', 'voice_state_update', data, member.id, newState.channelId || undefined);

    const embed = createEmbed({
      title: `${emojis.voice} Voice ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      description: `${member.user.tag} ${action} ${newState.channel ? `in ${newState.channel.name}` : ''}`,
      color,
      fields: [
        {
          name: 'User',
          value: `${member.user.tag} (${member.id})`,
          inline: true,
        },
      ],
      timestamp: true,
    });

    if (oldState.channel && newState.channel && oldState.channel !== newState.channel) {
      embed.addFields({
        name: 'From → To',
        value: `${oldState.channel.name} → ${newState.channel.name}`,
        inline: true,
      });
    } else if (newState.channel) {
      embed.addFields({
        name: 'Channel',
        value: newState.channel.name,
        inline: true,
      });
    }

    await this.sendLogEmbed(newState.guild?.id || '', 'voice', embed);
  }

  // Channel Events
  public async logChannelCreate(channel: any): Promise<void> {
    if (!channel.guild) return;

    const data = {
      channelId: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId,
      nsfw: channel.nsfw,
    };

    await this.logEvent(channel.guild.id, 'channel_create', data, undefined, channel.id);

    const embed = createEmbed({
      title: `${emojis.success} Channel Created`,
      description: `Channel ${channel.name} was created`,
      color: colors.success,
      fields: [
        {
          name: 'Channel',
          value: `${channel.name} (${channel.id})`,
          inline: true,
        },
        {
          name: 'Type',
          value: ChannelType[channel.type],
          inline: true,
        },
      ],
      timestamp: true,
    });

    await this.sendLogEmbed(channel.guild.id, 'channel', embed);
  }

  public async logChannelDelete(channel: any): Promise<void> {
    if (!channel.guild) return;

    const data = {
      channelId: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId,
    };

    await this.logEvent(channel.guild.id, 'channel_delete', data, undefined, channel.id);

    const embed = createEmbed({
      title: `${emojis.error} Channel Deleted`,
      description: `Channel ${channel.name} was deleted`,
      color: colors.error,
      fields: [
        {
          name: 'Channel',
          value: `${channel.name} (${channel.id})`,
          inline: true,
        },
        {
          name: 'Type',
          value: ChannelType[channel.type],
          inline: true,
        },
      ],
      timestamp: true,
    });

    await this.sendLogEmbed(channel.guild.id, 'channel', embed);
  }

  // Role Events
  public async logRoleCreate(role: Role): Promise<void> {
    const data = {
      roleId: role.id,
      name: role.name,
      color: role.color,
      permissions: role.permissions.bitfield.toString(),
      mentionable: role.mentionable,
      hoist: role.hoist,
    };

    await this.logEvent(role.guild.id, 'role_create', data, undefined, undefined, role.id);

    const embed = createEmbed({
      title: `${emojis.success} Role Created`,
      description: `Role ${role.name} was created`,
      color: colors.success,
      fields: [
        {
          name: 'Role',
          value: `${role.name} (${role.id})`,
          inline: true,
        },
        {
          name: 'Color',
          value: role.hexColor,
          inline: true,
        },
        {
          name: 'Mentionable',
          value: role.mentionable ? 'Yes' : 'No',
          inline: true,
        },
      ],
      timestamp: true,
    });

    await this.sendLogEmbed(role.guild.id, 'role', embed);
  }

  public async logRoleDelete(role: Role): Promise<void> {
    const data = {
      roleId: role.id,
      name: role.name,
      color: role.color,
      permissions: role.permissions.bitfield.toString(),
    };

    await this.logEvent(role.guild.id, 'role_delete', data, undefined, undefined, role.id);

    const embed = createEmbed({
      title: `${emojis.error} Role Deleted`,
      description: `Role ${role.name} was deleted`,
      color: colors.error,
      fields: [
        {
          name: 'Role',
          value: `${role.name} (${role.id})`,
          inline: true,
        },
        {
          name: 'Color',
          value: role.hexColor,
          inline: true,
        },
      ],
      timestamp: true,
    });

    await this.sendLogEmbed(role.guild.id, 'role', embed);
  }

  // Moderation Events
  public async logModerationAction(
    guildId: string,
    action: string,
    target: User,
    moderator: User,
    reason?: string,
    duration?: number
  ): Promise<void> {
    const data = {
      action,
      targetId: target.id,
      moderatorId: moderator.id,
      reason,
      duration,
    };

    await this.logEvent(guildId, 'moderation_action', data, target.id);

    const embed = createEmbed({
      title: `${emojis.shield} Moderation Action`,
      description: `${action.charAt(0).toUpperCase() + action.slice(1)} action performed`,
      color: colors.warning,
      fields: [
        {
          name: 'Action',
          value: action.charAt(0).toUpperCase() + action.slice(1),
          inline: true,
        },
        {
          name: 'Target',
          value: `${target.tag} (${target.id})`,
          inline: true,
        },
        {
          name: 'Moderator',
          value: `${moderator.tag} (${moderator.id})`,
          inline: true,
        },
      ],
      timestamp: true,
    });

    if (reason) {
      embed.addFields({
        name: 'Reason',
        value: reason,
        inline: false,
      });
    }

    if (duration) {
      embed.addFields({
        name: 'Duration',
        value: `${duration}ms`,
        inline: true,
      });
    }

    await this.sendLogEmbed(guildId, 'moderation', embed);
  }


  public async getLogEvents(guildId: string, limit: number = 50, type?: string): Promise<any[]> {
    let query = 'SELECT * FROM log_events WHERE guild_id = $1';
    const params: any[] = [guildId];

    if (type) {
      query += ' AND type = $2';
      params.push(type);
    }

    query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await db.query(query, params);
    return result.rows;
  }
}

export const loggingHandler = LoggingHandler.getInstance();