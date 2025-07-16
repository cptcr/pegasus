import { Guild, TextChannel, VoiceChannel, GuildMember } from 'discord.js';
import { db } from '../database/connection';
import { createEmbed } from '../utils/helpers';
import { colors, emojis } from '../utils/config';

export class StatsHandler {
  private static instance: StatsHandler;

  public static getInstance(): StatsHandler {
    if (!StatsHandler.instance) {
      StatsHandler.instance = new StatsHandler();
    }
    return StatsHandler.instance;
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  public async updateGuildStats(guildId: string, statsUpdate: Partial<{
    totalMessages: number;
    totalCommands: number;
    totalVoiceTime: number;
    totalMembers: number;
    activeMembers: number;
    newMembers: number;
    leftMembers: number;
    bannedMembers: number;
    kickedMembers: number;
    mutedMembers: number;
    warnedMembers: number;
    ticketsCreated: number;
    ticketsClosed: number;
  }>): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // Convert camelCase keys to snake_case for database
    const dbFields = Object.keys(statsUpdate).map(key => this.camelToSnake(key));
    const updateFields = dbFields.map(field => `${field} = guild_stats.${field} + EXCLUDED.${field}`).join(', ');
    const values = [guildId, today, ...Object.values(statsUpdate)];

    await db.query(
      `INSERT INTO guild_stats (guild_id, date, ${dbFields.join(', ')}) 
       VALUES ($1, $2, ${dbFields.map((_, i) => `$${i + 3}`).join(', ')})
       ON CONFLICT (guild_id, date) 
       DO UPDATE SET ${updateFields}`,
      values
    );
  }

  public async getGuildStats(guildId: string, days: number = 30): Promise<any[]> {
    const result = await db.query(
      `SELECT * FROM guild_stats 
       WHERE guild_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY date DESC`,
      [guildId]
    );

    return result.rows;
  }

  public async getTotalGuildStats(guildId: string): Promise<any> {
    const result = await db.query(
      `SELECT 
        SUM(total_messages) as total_messages,
        SUM(total_commands) as total_commands,
        SUM(total_voice_time) as total_voice_time,
        SUM(new_members) as new_members,
        SUM(left_members) as left_members,
        SUM(banned_members) as banned_members,
        SUM(kicked_members) as kicked_members,
        SUM(muted_members) as muted_members,
        SUM(warned_members) as warned_members,
        SUM(tickets_created) as tickets_created,
        SUM(tickets_closed) as tickets_closed
       FROM guild_stats 
       WHERE guild_id = $1`,
      [guildId]
    );

    return result.rows[0];
  }

  public async getTopUsers(guildId: string, type: 'messages' | 'voice' | 'xp', limit: number = 10): Promise<any[]> {
    let orderBy = 'message_count';
    if (type === 'voice') orderBy = 'voice_time';
    if (type === 'xp') orderBy = 'total_xp';

    const result = await db.query(
      `SELECT user_id, ${orderBy} as value FROM user_profiles 
       WHERE guild_id = $1 
       ORDER BY ${orderBy} DESC 
       LIMIT $2`,
      [guildId, limit]
    );

    return result.rows;
  }

  public async getChannelStats(guildId: string): Promise<any> {
    const result = await db.query(
      `SELECT 
        COUNT(CASE WHEN type = 'message_create' THEN 1 END) as total_messages,
        COUNT(CASE WHEN type = 'voice_join' THEN 1 END) as voice_joins,
        COUNT(CASE WHEN type = 'voice_leave' THEN 1 END) as voice_leaves
       FROM log_events 
       WHERE guild_id = $1 AND timestamp >= CURRENT_DATE - INTERVAL '30 days'`,
      [guildId]
    );

    return result.rows[0];
  }

  public async getModerationStats(guildId: string): Promise<any> {
    const result = await db.query(
      `SELECT 
        action,
        COUNT(*) as count
       FROM mod_actions 
       WHERE guild_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY action`,
      [guildId]
    );

    return result.rows;
  }

  public async getServerOverview(guild: Guild): Promise<any> {
    const totalStats = await this.getTotalGuildStats(guild.id);
    const moderationStats = await this.getModerationStats(guild.id);
    const channelStats = await this.getChannelStats(guild.id);

    const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
    const categories = guild.channels.cache.filter(c => c.type === 4).size;

    const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
    const botMembers = guild.members.cache.filter(m => m.user.bot).size;
    const humanMembers = guild.memberCount - botMembers;

    return {
      general: {
        name: guild.name,
        id: guild.id,
        owner: guild.ownerId,
        created: guild.createdAt,
        memberCount: guild.memberCount,
        humanMembers,
        botMembers,
        onlineMembers,
        boostLevel: guild.premiumTier,
        boostCount: guild.premiumSubscriptionCount,
        textChannels,
        voiceChannels,
        categories,
        roles: guild.roles.cache.size,
        emojis: guild.emojis.cache.size,
      },
      activity: {
        totalMessages: totalStats.total_messages || 0,
        totalCommands: totalStats.total_commands || 0,
        totalVoiceTime: totalStats.total_voice_time || 0,
        voiceJoins: channelStats.voice_joins || 0,
        voiceLeaves: channelStats.voice_leaves || 0,
      },
      moderation: {
        totalBans: totalStats.banned_members || 0,
        totalKicks: totalStats.kicked_members || 0,
        totalMutes: totalStats.muted_members || 0,
        totalWarns: totalStats.warned_members || 0,
        recentActions: moderationStats,
      },
      tickets: {
        totalCreated: totalStats.tickets_created || 0,
        totalClosed: totalStats.tickets_closed || 0,
      },
      growth: {
        newMembers: totalStats.new_members || 0,
        leftMembers: totalStats.left_members || 0,
      },
    };
  }

  public async generateStatsEmbed(guild: Guild, type: 'overview' | 'activity' | 'moderation' | 'users' = 'overview'): Promise<any> {
    const overview = await this.getServerOverview(guild);

    switch (type) {
      case 'overview':
        return createEmbed({
          title: `${emojis.stats} Server Statistics - ${guild.name}`,
          description: `General server information and statistics`,
          color: colors.primary,
          thumbnail: guild.iconURL() || undefined,
          fields: [
            {
              name: '👥 Members',
              value: `Total: ${overview.general.memberCount}\n` +
                     `Humans: ${overview.general.humanMembers}\n` +
                     `Bots: ${overview.general.botMembers}\n` +
                     `Online: ${overview.general.onlineMembers}`,
              inline: true,
            },
            {
              name: '📊 Channels',
              value: `Text: ${overview.general.textChannels}\n` +
                     `Voice: ${overview.general.voiceChannels}\n` +
                     `Categories: ${overview.general.categories}`,
              inline: true,
            },
            {
              name: '🎭 Features',
              value: `Roles: ${overview.general.roles}\n` +
                     `Emojis: ${overview.general.emojis}\n` +
                     `Boost Level: ${overview.general.boostLevel}\n` +
                     `Boosts: ${overview.general.boostCount}`,
              inline: true,
            },
            {
              name: '💬 Activity (All Time)',
              value: `Messages: ${overview.activity.totalMessages.toLocaleString()}\n` +
                     `Commands: ${overview.activity.totalCommands.toLocaleString()}\n` +
                     `Voice Time: ${Math.floor(overview.activity.totalVoiceTime / 3600)}h`,
              inline: true,
            },
            {
              name: '🔨 Moderation',
              value: `Bans: ${overview.moderation.totalBans}\n` +
                     `Kicks: ${overview.moderation.totalKicks}\n` +
                     `Mutes: ${overview.moderation.totalMutes}\n` +
                     `Warnings: ${overview.moderation.totalWarns}`,
              inline: true,
            },
            {
              name: '🎫 Tickets',
              value: `Created: ${overview.tickets.totalCreated}\n` +
                     `Closed: ${overview.tickets.totalClosed}`,
              inline: true,
            },
          ],
          footer: `Server created: ${overview.general.created.toDateString()}`,
          timestamp: true,
        });

      case 'activity':
        const topMessages = await this.getTopUsers(guild.id, 'messages', 5);
        const topVoice = await this.getTopUsers(guild.id, 'voice', 5);
        const topXp = await this.getTopUsers(guild.id, 'xp', 5);

        return createEmbed({
          title: `${emojis.stats} Activity Statistics - ${guild.name}`,
          description: `Server activity and user engagement`,
          color: colors.blue,
          thumbnail: guild.iconURL() || undefined,
          fields: [
            {
              name: '💬 Top Message Senders',
              value: topMessages.map((user, i) => {
                const member = guild.members.cache.get(user.user_id);
                return `${i + 1}. ${member?.displayName || 'Unknown'}: ${user.value.toLocaleString()}`;
              }).join('\n') || 'No data',
              inline: true,
            },
            {
              name: '🎤 Top Voice Users',
              value: topVoice.map((user, i) => {
                const member = guild.members.cache.get(user.user_id);
                const hours = Math.floor(user.value / 3600);
                return `${i + 1}. ${member?.displayName || 'Unknown'}: ${hours}h`;
              }).join('\n') || 'No data',
              inline: true,
            },
            {
              name: '⭐ Top XP Earners',
              value: topXp.map((user, i) => {
                const member = guild.members.cache.get(user.user_id);
                return `${i + 1}. ${member?.displayName || 'Unknown'}: ${user.value.toLocaleString()}`;
              }).join('\n') || 'No data',
              inline: true,
            },
          ],
          timestamp: true,
        });

      case 'moderation':
        const recentActions = overview.moderation.recentActions;
        
        return createEmbed({
          title: `${emojis.shield} Moderation Statistics - ${guild.name}`,
          description: `Server moderation activity and enforcement`,
          color: colors.red,
          thumbnail: guild.iconURL() || undefined,
          fields: [
            {
              name: '📈 All Time Actions',
              value: `Bans: ${overview.moderation.totalBans}\n` +
                     `Kicks: ${overview.moderation.totalKicks}\n` +
                     `Mutes: ${overview.moderation.totalMutes}\n` +
                     `Warnings: ${overview.moderation.totalWarns}`,
              inline: true,
            },
            {
              name: '🗓️ Recent Actions (30 days)',
              value: recentActions.map((action: any) => 
                `${action.action.charAt(0).toUpperCase() + action.action.slice(1)}s: ${action.count}`
              ).join('\n') || 'No recent actions',
              inline: true,
            },
          ],
          timestamp: true,
        });

      default:
        return null;
    }
  }

  public async incrementMessageCount(guildId: string, userId: string): Promise<void> {
    await this.updateGuildStats(guildId, { totalMessages: 1 });
  }

  public async incrementCommandCount(guildId: string): Promise<void> {
    await this.updateGuildStats(guildId, { totalCommands: 1 });
  }

  public async incrementVoiceTime(guildId: string, duration: number): Promise<void> {
    await this.updateGuildStats(guildId, { totalVoiceTime: duration });
  }

  public async incrementMemberJoin(guildId: string): Promise<void> {
    await this.updateGuildStats(guildId, { newMembers: 1 });
  }

  public async incrementMemberLeave(guildId: string): Promise<void> {
    await this.updateGuildStats(guildId, { leftMembers: 1 });
  }

  public async incrementModerationAction(guildId: string, action: string): Promise<void> {
    const updateObj: any = {};
    
    switch (action) {
      case 'ban':
        updateObj.bannedMembers = 1;
        break;
      case 'kick':
        updateObj.kickedMembers = 1;
        break;
      case 'mute':
        updateObj.mutedMembers = 1;
        break;
      case 'warn':
        updateObj.warnedMembers = 1;
        break;
    }

    if (Object.keys(updateObj).length > 0) {
      await this.updateGuildStats(guildId, updateObj);
    }
  }

  public async incrementTicketAction(guildId: string, action: 'created' | 'closed'): Promise<void> {
    const updateObj: any = {};
    
    if (action === 'created') {
      updateObj.ticketsCreated = 1;
    } else if (action === 'closed') {
      updateObj.ticketsClosed = 1;
    }

    await this.updateGuildStats(guildId, updateObj);
  }
}

export const statsHandler = StatsHandler.getInstance();