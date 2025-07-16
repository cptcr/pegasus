import { Message, GuildMember, VoiceState, TextChannel } from 'discord.js';
import { db } from '../database/connection';
import { getRandomXp, getLevelFromXp, getXpForLevel, createSuccessEmbed } from '../utils/helpers';
import { limits, emojis } from '../utils/config';

export class XPHandler {
  private static instance: XPHandler;
  private xpCooldowns = new Map<string, number>();
  private voiceSessions = new Map<string, { joinTime: number; channelId: string }>();

  public static getInstance(): XPHandler {
    if (!XPHandler.instance) {
      XPHandler.instance = new XPHandler();
    }
    return XPHandler.instance;
  }

  public async handleMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    const settings = await this.getGuildSettings(message.guild.id);
    if (!settings.xp_enabled) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const cooldownKey = `${userId}-${guildId}`;

    const now = Date.now();
    const lastXp = this.xpCooldowns.get(cooldownKey) || 0;

    if (now - lastXp < (settings.xp_cooldown * 1000)) return;

    this.xpCooldowns.set(cooldownKey, now);

    const xpGained = getRandomXp(10, settings.xp_rate);
    await this.addXp(userId, guildId, xpGained, message.channel as TextChannel);
  }

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (!newState.guild) return;

    const settings = await this.getGuildSettings(newState.guild.id);
    if (!settings.xp_enabled) return;

    const userId = newState.member?.id;
    if (!userId || newState.member?.user.bot) return;

    const sessionKey = `${userId}-${newState.guild.id}`;

    if (newState.channelId && !oldState.channelId) {
      this.voiceSessions.set(sessionKey, {
        joinTime: Date.now(),
        channelId: newState.channelId,
      });

      await db.query(
        `INSERT INTO voice_sessions (user_id, guild_id, channel_id, join_time, afk, muted, deafened) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          newState.guild.id,
          newState.channelId,
          new Date(),
          newState.selfDeaf || false,
          newState.mute || false,
          newState.deaf || false,
        ]
      );
    }

    if (!newState.channelId && oldState.channelId) {
      const session = this.voiceSessions.get(sessionKey);
      if (session) {
        const duration = Date.now() - session.joinTime;
        this.voiceSessions.delete(sessionKey);

        await db.query(
          `UPDATE voice_sessions SET leave_time = $1, duration = $2 
           WHERE user_id = $3 AND guild_id = $4 AND channel_id = $5 AND leave_time IS NULL`,
          [new Date(), Math.floor(duration / 1000), userId, newState.guild.id, oldState.channelId]
        );

        if (duration >= limits.voiceXpInterval) {
          const xpGained = Math.floor(duration / limits.voiceXpInterval) * 5;
          await this.addXp(userId, newState.guild.id, xpGained);
        }
      }
    }
  }

  public async addXp(userId: string, guildId: string, amount: number, channel?: TextChannel): Promise<void> {
    await db.query(
      `INSERT INTO user_profiles (user_id, guild_id, xp, total_xp, last_xp_gain, message_count) 
       VALUES ($1, $2, $3, $3, $4, 1)
       ON CONFLICT (user_id, guild_id) 
       DO UPDATE SET 
         xp = user_profiles.xp + $3,
         total_xp = user_profiles.total_xp + $3,
         last_xp_gain = $4,
         message_count = user_profiles.message_count + 1`,
      [userId, guildId, amount, new Date()]
    );

    const userProfile = await db.query(
      'SELECT xp, level, total_xp FROM user_profiles WHERE user_id = $1 AND guild_id = $2',
      [userId, guildId]
    );

    const profile = userProfile.rows[0];
    if (!profile) return;

    const newLevel = getLevelFromXp(profile.total_xp);
    const oldLevel = profile.level;

    if (newLevel > oldLevel) {
      await db.query(
        'UPDATE user_profiles SET level = $1 WHERE user_id = $2 AND guild_id = $3',
        [newLevel, userId, guildId]
      );

      await this.handleLevelUp(userId, guildId, newLevel, channel);
    }
  }

  private async handleLevelUp(userId: string, guildId: string, newLevel: number, channel?: TextChannel): Promise<void> {
    const settings = await this.getGuildSettings(guildId);
    
    if (settings.level_up_channel) {
      const levelUpChannel = channel?.guild?.channels.cache.get(settings.level_up_channel) as TextChannel;
      if (levelUpChannel) {
        const embed = createSuccessEmbed(
          'Level Up!',
          `${emojis.level} <@${userId}> has reached level **${newLevel}**! ${emojis.tada}`
        );

        await levelUpChannel.send({ embeds: [embed] });
      }
    } else if (channel) {
      const embed = createSuccessEmbed(
        'Level Up!',
        `${emojis.level} <@${userId}> has reached level **${newLevel}**! ${emojis.tada}`
      );

      await channel.send({ embeds: [embed] });
    }
  }

  public async getLeaderboard(guildId: string, limit: number = 10): Promise<any[]> {
    const result = await db.query(
      `SELECT user_id, level, total_xp, xp, message_count, voice_time 
       FROM user_profiles 
       WHERE guild_id = $1 
       ORDER BY total_xp DESC 
       LIMIT $2`,
      [guildId, limit]
    );

    return result.rows;
  }

  public async getUserProfile(userId: string, guildId: string): Promise<any> {
    const result = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1 AND guild_id = $2',
      [userId, guildId]
    );

    if (result.rows.length === 0) {
      await db.query(
        'INSERT INTO user_profiles (user_id, guild_id) VALUES ($1, $2)',
        [userId, guildId]
      );

      return {
        user_id: userId,
        guild_id: guildId,
        xp: 0,
        level: 1,
        total_xp: 0,
        voice_time: 0,
        message_count: 0,
        warnings: 0,
        reputation: 0,
        coins: 0,
        created_at: new Date(),
      };
    }

    return result.rows[0];
  }

  public async getUserRank(userId: string, guildId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) + 1 as rank 
       FROM user_profiles 
       WHERE guild_id = $1 AND total_xp > (
         SELECT total_xp FROM user_profiles WHERE user_id = $2 AND guild_id = $1
       )`,
      [guildId, userId]
    );

    return result.rows[0]?.rank || 1;
  }

  private async getGuildSettings(guildId: string): Promise<any> {
    const result = await db.query(
      'SELECT xp_enabled, xp_rate, xp_cooldown, level_up_channel FROM guild_settings WHERE guild_id = $1',
      [guildId]
    );

    if (result.rows.length === 0) {
      await db.query(
        'INSERT INTO guild_settings (guild_id) VALUES ($1)',
        [guildId]
      );

      return {
        xp_enabled: true,
        xp_rate: 15,
        xp_cooldown: 60,
        level_up_channel: null,
      };
    }

    return result.rows[0];
  }

  public async setXpEnabled(guildId: string, enabled: boolean): Promise<void> {
    await db.query(
      `INSERT INTO guild_settings (guild_id, xp_enabled) VALUES ($1, $2)
       ON CONFLICT (guild_id) DO UPDATE SET xp_enabled = $2`,
      [guildId, enabled]
    );
  }

  public async setXpRate(guildId: string, rate: number): Promise<void> {
    await db.query(
      `INSERT INTO guild_settings (guild_id, xp_rate) VALUES ($1, $2)
       ON CONFLICT (guild_id) DO UPDATE SET xp_rate = $2`,
      [guildId, rate]
    );
  }

  public async setXpCooldown(guildId: string, cooldown: number): Promise<void> {
    await db.query(
      `INSERT INTO guild_settings (guild_id, xp_cooldown) VALUES ($1, $2)
       ON CONFLICT (guild_id) DO UPDATE SET xp_cooldown = $2`,
      [guildId, cooldown]
    );
  }

  public async setLevelUpChannel(guildId: string, channelId: string | null): Promise<void> {
    await db.query(
      `INSERT INTO guild_settings (guild_id, level_up_channel) VALUES ($1, $2)
       ON CONFLICT (guild_id) DO UPDATE SET level_up_channel = $2`,
      [guildId, channelId]
    );
  }
}

export const xpHandler = XPHandler.getInstance();