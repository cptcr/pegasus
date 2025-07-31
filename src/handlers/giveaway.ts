import { TextChannel, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, Guild, GuildMember, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { db } from '../database/connection';
import { Giveaway, GiveawayEntry, GiveawayWinner, GiveawayRequirements, GiveawayBonusEntries } from '../types';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/helpers';
import { config } from '../config';
import { logger } from '../utils/logger';
import { economyHandler } from './economy';
import { xpHandler } from './xp';

export class GiveawayHandler {
  private activeGiveaways = new Map<string, NodeJS.Timeout>();

  public async createGiveaway(
    guildId: string,
    channelId: string,
    hostId: string,
    title: string,
    prize: string,
    duration: number,
    winnerCount: number = 1,
    description?: string,
    requirements?: GiveawayRequirements,
    bonusEntries?: GiveawayBonusEntries,
    embedConfig?: any
  ): Promise<string | null> {
    try {
      const endTime = new Date(Date.now() + duration);
      
      const result = await db.query(
        `INSERT INTO giveaways (
          guild_id, channel_id, host_id, title, description, prize, 
          winner_count, end_time, requirements, bonus_entries, embed_config
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING id`,
        [
          guildId, 
          channelId, 
          hostId, 
          title, 
          description, 
          prize, 
          winnerCount, 
          endTime,
          JSON.stringify(requirements || {}),
          JSON.stringify(bonusEntries || {}),
          JSON.stringify(embedConfig || {})
        ]
      );

      const giveawayId = result.rows[0].id;

      // Post the giveaway message
      await this.postGiveawayMessage(giveawayId, channelId);

      // Schedule automatic ending
      this.scheduleGiveawayEnd(giveawayId, duration);

      return giveawayId;
    } catch (error) {
      logger.error('Error creating giveaway', error as Error);
      return null;
    }
  }

  public async postGiveawayMessage(giveawayId: string, channelId: string): Promise<void> {
    try {
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway) return;

      const guild = global.client?.guilds.cache.get(giveaway.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(channelId) as TextChannel;
      if (!channel) return;

      // Create embed from config or default
      const embed = this.createGiveawayEmbed(giveaway);

      // Create enhanced button layout with enter and info buttons
      const entryCount = await this.getGiveawayEntryCount(giveawayId);
      const publicButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_enter_${giveawayId}`)
            .setLabel(`🎉 Enter Giveaway (${entryCount} entries)`)
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`giveaway_info_${giveawayId}`)
            .setLabel('ℹ️ Details')
            .setStyle(ButtonStyle.Secondary)
        );

      // Create admin management select menu (only visible to admins via separate command)
      const components = [publicButtons];

      const message = await channel.send({
        embeds: [embed],
        components,
      });

      // Update giveaway with message ID
      await db.query(
        'UPDATE giveaways SET message_id = $1 WHERE id = $2',
        [message.id, giveawayId]
      );

      logger.info('Giveaway message posted', { giveawayId, messageId: message.id });
    } catch (error) {
      logger.error('Error posting giveaway message', error as Error);
    }
  }

  public async enterGiveaway(giveawayId: string, userId: string, guildId: string): Promise<{ success: boolean; message: string; entryCount?: number }> {
    try {
      // Get giveaway details
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway) {
        return { success: false, message: 'Giveaway not found.' };
      }

      if (giveaway.ended || giveaway.cancelled) {
        return { success: false, message: 'This giveaway has already ended.' };
      }

      if (new Date() > giveaway.endTime) {
        return { success: false, message: 'This giveaway has expired.' };
      }

      // Check if user is blacklisted
      if (giveaway.blacklist.includes(userId)) {
        return { success: false, message: 'You are not eligible to enter this giveaway.' };
      }

      // Check if whitelist exists and user is not on it
      if (giveaway.whitelist.length > 0 && !giveaway.whitelist.includes(userId)) {
        return { success: false, message: 'You are not eligible to enter this giveaway.' };
      }

      const guild = global.client?.guilds.cache.get(guildId);
      if (!guild) return { success: false, message: 'Guild not found.' };

      const member = await guild.members.fetch(userId);
      if (!member) return { success: false, message: 'Member not found.' };

      // Check requirements
      const requirementCheck = await this.checkRequirements(member, giveaway.requirements);
      if (!requirementCheck.eligible) {
        return { success: false, message: requirementCheck.reason || 'You do not meet the requirements for this giveaway.' };
      }

      // Check if already entered
      const existingEntry = await db.query(
        'SELECT entry_count FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
        [giveawayId, userId]
      );

      if (existingEntry.rows.length > 0) {
        return { success: false, message: 'You have already entered this giveaway.' };
      }

      // Calculate bonus entries
      const bonusEntries = await this.calculateBonusEntries(member, giveaway.bonusEntries);
      const totalEntries = 1 + bonusEntries.count;

      // Insert entry
      await db.query(
        `INSERT INTO giveaway_entries (giveaway_id, user_id, entry_count, bonus_reason, entry_metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          giveawayId, 
          userId, 
          totalEntries, 
          bonusEntries.reasons.join(', ') || null,
          JSON.stringify({
            enteredAt: new Date(),
            memberSince: member.joinedAt,
            roles: member.roles.cache.map(r => r.id),
          })
        ]
      );

      // Update entry count on the giveaway message with real-time updates
      await this.updateGiveawayMessageRealtime(giveawayId);

      logger.info('User entered giveaway', { giveawayId, userId, totalEntries });

      return { 
        success: true, 
        message: `Successfully entered! You have ${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'}.`,
        entryCount: totalEntries
      };
    } catch (error) {
      logger.error('Error entering giveaway', error as Error);
      return { success: false, message: 'An error occurred while entering the giveaway.' };
    }
  }

  public async endGiveaway(giveawayId: string, force: boolean = false): Promise<{ success: boolean; winners?: string[]; message: string }> {
    try {
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway) {
        return { success: false, message: 'Giveaway not found.' };
      }

      if (giveaway.ended && !force) {
        return { success: false, message: 'This giveaway has already ended.' };
      }

      // Get all entries
      const entries = await db.query(
        `SELECT user_id, entry_count FROM giveaway_entries 
         WHERE giveaway_id = $1`,
        [giveawayId]
      );

      if (entries.rows.length === 0) {
        // Mark as ended with no winners
        await db.query(
          'UPDATE giveaways SET ended = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [giveawayId]
        );

        await this.updateGiveawayMessage(giveaway, []);
        return { success: true, winners: [], message: 'Giveaway ended with no participants.' };
      }

      // Create weighted array for random selection
      const weightedEntries: string[] = [];
      for (const entry of entries.rows) {
        for (let i = 0; i < entry.entry_count; i++) {
          weightedEntries.push(entry.user_id);
        }
      }

      // Select winners
      const winners: string[] = [];
      const selectedUsers = new Set<string>();

      for (let i = 0; i < Math.min(giveaway.winnerCount, entries.rows.length); i++) {
        let attempts = 0;
        let winner: string;
        
        do {
          winner = weightedEntries[Math.floor(Math.random() * weightedEntries.length)];
          attempts++;
        } while (selectedUsers.has(winner) && attempts < 100);

        if (!selectedUsers.has(winner)) {
          winners.push(winner);
          selectedUsers.add(winner);

          // Insert winner record
          await db.query(
            `INSERT INTO giveaway_winners (giveaway_id, user_id)
             VALUES ($1, $2)`,
            [giveawayId, winner]
          );
        }
      }

      // Mark giveaway as ended
      await db.query(
        'UPDATE giveaways SET ended = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [giveawayId]
      );

      // Update the giveaway message
      await this.updateGiveawayMessage(giveaway, winners);

      // Clear scheduled end
      if (this.activeGiveaways.has(giveawayId)) {
        clearTimeout(this.activeGiveaways.get(giveawayId)!);
        this.activeGiveaways.delete(giveawayId);
      }

      logger.audit('GIVEAWAY_ENDED', 'system', giveaway.guildId, {
        giveawayId,
        winners,
        participants: entries.rows.length,
        totalEntries: weightedEntries.length,
      });

      return { success: true, winners, message: `Giveaway ended! ${winners.length} winner(s) selected.` };
    } catch (error) {
      logger.error('Error ending giveaway', error as Error);
      return { success: false, message: 'An error occurred while ending the giveaway.' };
    }
  }

  public async rerollGiveaway(giveawayId: string, rerollCount: number = 1): Promise<{ success: boolean; winners?: string[]; message: string }> {
    try {
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway || !giveaway.ended) {
        return { success: false, message: 'Giveaway not found or not ended.' };
      }

      // Mark existing winners as rerolled
      await db.query(
        'UPDATE giveaway_winners SET rerolled = true WHERE giveaway_id = $1 AND rerolled = false',
        [giveawayId]
      );

      // Get all entries excluding previous winners
      const previousWinners = await db.query(
        'SELECT user_id FROM giveaway_winners WHERE giveaway_id = $1',
        [giveawayId]
      );

      const previousWinnerIds = previousWinners.rows.map((row: any) => row.user_id);

      const entries = await db.query(
        `SELECT user_id, entry_count FROM giveaway_entries 
         WHERE giveaway_id = $1 AND user_id != ALL($2)`,
        [giveawayId, previousWinnerIds]
      );

      if (entries.rows.length === 0) {
        return { success: false, message: 'No more eligible participants for reroll.' };
      }

      // Select new winners using same logic as original ending
      const weightedEntries: string[] = [];
      for (const entry of entries.rows) {
        for (let i = 0; i < entry.entry_count; i++) {
          weightedEntries.push(entry.user_id);
        }
      }

      const newWinners: string[] = [];
      const selectedUsers = new Set<string>();

      for (let i = 0; i < Math.min(rerollCount, entries.rows.length); i++) {
        let attempts = 0;
        let winner: string;
        
        do {
          winner = weightedEntries[Math.floor(Math.random() * weightedEntries.length)];
          attempts++;
        } while (selectedUsers.has(winner) && attempts < 100);

        if (!selectedUsers.has(winner)) {
          newWinners.push(winner);
          selectedUsers.add(winner);

          // Insert new winner record
          await db.query(
            `INSERT INTO giveaway_winners (giveaway_id, user_id)
             VALUES ($1, $2)`,
            [giveawayId, winner]
          );
        }
      }

      // Update the giveaway message with new winners
      await this.updateGiveawayMessage(giveaway, newWinners, true);

      logger.audit('GIVEAWAY_REROLLED', 'system', giveaway.guildId, {
        giveawayId,
        newWinners,
        rerollCount,
      });

      return { success: true, winners: newWinners, message: `Reroll complete! ${newWinners.length} new winner(s) selected.` };
    } catch (error) {
      logger.error('Error rerolling giveaway', error as Error);
      return { success: false, message: 'An error occurred while rerolling the giveaway.' };
    }
  }

  private async checkRequirements(member: GuildMember, requirements: GiveawayRequirements): Promise<{ eligible: boolean; reason?: string }> {
    // Check minimum level
    if (requirements.minLevel) {
      const userProfile = await xpHandler.getUserProfile(member.id, member.guild.id);
      if (!userProfile || userProfile.level < requirements.minLevel) {
        return { eligible: false, reason: `Minimum level required: ${requirements.minLevel}` };
      }
    }

    // Check required roles
    if (requirements.requiredRoles && requirements.requiredRoles.length > 0) {
      const hasRequiredRole = requirements.requiredRoles.some(roleId => member.roles.cache.has(roleId));
      if (!hasRequiredRole) {
        return { eligible: false, reason: 'You do not have the required roles.' };
      }
    }

    // Check account age
    if (requirements.minAccountAge) {
      const accountAge = Date.now() - member.user.createdTimestamp;
      if (accountAge < requirements.minAccountAge) {
        return { eligible: false, reason: 'Your account is too new.' };
      }
    }

    // Check join age
    if (requirements.minJoinAge && member.joinedTimestamp) {
      const joinAge = Date.now() - member.joinedTimestamp;
      if (joinAge < requirements.minJoinAge) {
        return { eligible: false, reason: 'You joined the server too recently.' };
      }
    }

    // Check voice requirement
    if (requirements.mustBeInVoice) {
      if (!member.voice.channel) {
        return { eligible: false, reason: 'You must be in a voice channel to enter.' };
      }
    }

    return { eligible: true };
  }

  private async calculateBonusEntries(member: GuildMember, bonusEntries: GiveawayBonusEntries): Promise<{ count: number; reasons: string[] }> {
    let bonusCount = 0;
    const reasons: string[] = [];

    // Role bonuses
    if (bonusEntries.roles) {
      for (const [roleId, bonus] of Object.entries(bonusEntries.roles)) {
        if (member.roles.cache.has(roleId)) {
          bonusCount += bonus;
          const role = member.guild.roles.cache.get(roleId);
          reasons.push(`+${bonus} for ${role?.name || 'role'}`);
        }
      }
    }

    // Boost bonus
    if (bonusEntries.boosts && member.premiumSince) {
      bonusCount += bonusEntries.boosts;
      reasons.push(`+${bonusEntries.boosts} for server boost`);
    }

    // Level bonuses
    if (bonusEntries.level) {
      const userProfile = await xpHandler.getUserProfile(member.id, member.guild.id);
      if (userProfile) {
        for (const [level, bonus] of Object.entries(bonusEntries.level)) {
          if (userProfile.level >= parseInt(level)) {
            bonusCount += bonus;
            reasons.push(`+${bonus} for level ${level}+`);
          }
        }
      }
    }

    return { count: bonusCount, reasons };
  }

  private createGiveawayEmbed(giveaway: Giveaway & { embed_config?: any }, winners?: string[], isReroll: boolean = false): EmbedBuilder {
    // Check if custom embed config exists
    if (giveaway.embed_config && Object.keys(giveaway.embed_config).length > 0) {
      const embed = new EmbedBuilder();
      const embedConfig = giveaway.embed_config;
      
      if (embedConfig.title) embed.setTitle(embedConfig.title);
      if (embedConfig.description) {
        // Replace placeholders
        let description = embedConfig.description;
        description = description.replace('{prize}', giveaway.prize);
        description = description.replace('{winners}', giveaway.winnerCount.toString());
        description = description.replace('{time}', giveaway.ended ? 'Ended' : `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`);
        embed.setDescription(description);
      }
      if (embedConfig.color) embed.setColor(embedConfig.color);
      if (embedConfig.thumbnail) embed.setThumbnail(embedConfig.thumbnail);
      if (embedConfig.image) embed.setImage(embedConfig.image);
      if (embedConfig.footer) embed.setFooter(embedConfig.footer);
      if (embedConfig.author) embed.setAuthor(embedConfig.author);
      if (embedConfig.fields) embed.addFields(embedConfig.fields);
      if (embedConfig.timestamp) embed.setTimestamp();
      
      // Add winners if ended
      if (giveaway.ended && winners) {
        if (winners.length > 0) {
          embed.addFields([
            { 
              name: isReroll ? '🔄 New Winners' : '🎉 Winners', 
              value: winners.map(id => `<@${id}>`).join('\n'), 
              inline: false 
            }
          ]);
        } else {
          embed.addFields([
            { name: '😔 No Winners', value: 'No eligible participants', inline: false }
          ]);
        }
      }
      
      return embed;
    }
    
    // Default embed
    const embed = new EmbedBuilder()
      .setTitle(`${config.getEmoji('gift')} ${giveaway.title}`)
      .setDescription(giveaway.description || `React with 🎉 to enter!`)
      .setColor(giveaway.ended ? config.getColor('success') as any : config.getColor('primary') as any)
      .addFields([
        { name: '🎁 Prize', value: giveaway.prize, inline: true },
        { name: '👑 Winners', value: giveaway.winnerCount.toString(), inline: true },
        { name: '⏰ Ends', value: giveaway.ended ? 'Ended' : `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`, inline: true }
      ]);

    if (giveaway.ended && winners) {
      if (winners.length > 0) {
        embed.addFields([
          { 
            name: isReroll ? '🔄 New Winners' : '🎉 Winners', 
            value: winners.map(id => `<@${id}>`).join('\n'), 
            inline: false 
          }
        ]);
      } else {
        embed.addFields([
          { name: '😔 No Winners', value: 'No eligible participants', inline: false }
        ]);
      }
    }

    embed.setFooter({ text: `Hosted by ${giveaway.hostId} • ID: ${giveaway.id}` });

    return embed;
  }

  private async updateGiveawayMessage(giveaway: Giveaway & { embed_config?: any }, winners: string[], isReroll: boolean = false): Promise<void> {
    if (!giveaway.messageId) return;

    try {
      const guild = global.client?.guilds.cache.get(giveaway.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.messageId);
      if (!message) return;

      const embed = this.createGiveawayEmbed(giveaway, winners, isReroll);

      await message.edit({
        embeds: [embed],
        components: [] // Remove button when ended
      });

      // Send winner announcement if there are winners
      if (winners.length > 0) {
        const winnerEmbed = createSuccessEmbed(
          isReroll ? '🔄 Giveaway Rerolled!' : '🎉 Giveaway Ended!',
          `**${giveaway.title}**\n\n**Winner(s):**\n${winners.map(id => `<@${id}>`).join('\n')}\n\n**Prize:** ${giveaway.prize}`
        );

        await channel.send({ 
          content: winners.map(id => `<@${id}>`).join(' '),
          embeds: [winnerEmbed] 
        });
      }
    } catch (error) {
      logger.error('Error updating giveaway message', error as Error);
    }
  }

  private async updateEntryCount(giveaway: Giveaway): Promise<void> {
    if (!giveaway.messageId) return;

    try {
      const entryCount = await db.count('giveaway_entries', { giveaway_id: giveaway.id });
      
      const guild = global.client?.guilds.cache.get(giveaway.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.messageId);
      if (!message) return;

      // Update the button with entry count
      const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_enter_${giveaway.id}`)
            .setLabel(`🎉 Enter Giveaway (${entryCount} entries)`)
            .setStyle(ButtonStyle.Success)
        );

      await message.edit({ components: [button] });
    } catch (error) {
      logger.error('Error updating entry count', error as Error);
    }
  }

  public scheduleGiveawayEnd(giveawayId: string, duration: number): void {
    const timeout = setTimeout(async () => {
      await this.endGiveaway(giveawayId);
      this.activeGiveaways.delete(giveawayId);
    }, duration);

    this.activeGiveaways.set(giveawayId, timeout);
  }

  public async getGiveaway(giveawayId: string): Promise<(Giveaway & { embed_config?: any }) | null> {
    try {
      const result = await db.query(
        'SELECT * FROM giveaways WHERE id = $1',
        [giveawayId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        guildId: row.guild_id,
        channelId: row.channel_id,
        messageId: row.message_id,
        hostId: row.host_id,
        title: row.title,
        description: row.description,
        prize: row.prize,
        winnerCount: row.winner_count,
        endTime: new Date(row.end_time),
        ended: row.ended,
        cancelled: row.cancelled,
        requirements: row.requirements || {},
        bonusEntries: row.bonus_entries || {},
        blacklist: row.blacklist || [],
        whitelist: row.whitelist || [],
        embed_config: row.embed_config || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      logger.error('Error getting giveaway', error as Error);
      return null;
    }
  }

  public async getGuildGiveaways(guildId: string, activeOnly: boolean = false): Promise<Giveaway[]> {
    try {
      let query = 'SELECT * FROM giveaways WHERE guild_id = $1';
      if (activeOnly) {
        query += ' AND ended = false AND cancelled = false';
      }
      query += ' ORDER BY created_at DESC';

      const result = await db.query(query, [guildId]);

      return result.rows.map((row: any) => ({
        id: row.id,
        guildId: row.guild_id,
        channelId: row.channel_id,
        messageId: row.message_id,
        hostId: row.host_id,
        title: row.title,
        description: row.description,
        prize: row.prize,
        winnerCount: row.winner_count,
        endTime: new Date(row.end_time),
        ended: row.ended,
        cancelled: row.cancelled,
        requirements: row.requirements || {},
        bonusEntries: row.bonus_entries || {},
        blacklist: row.blacklist || [],
        whitelist: row.whitelist || [],
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      logger.error('Error getting guild giveaways', error as Error);
      return [];
    }
  }

  public async initializeScheduledGiveaways(): Promise<void> {
    try {
      const activeGiveaways = await db.query(
        'SELECT id, end_time FROM giveaways WHERE ended = false AND cancelled = false'
      );

      for (const giveaway of activeGiveaways.rows) {
        const endTime = new Date(giveaway.end_time);
        const now = new Date();
        const timeRemaining = endTime.getTime() - now.getTime();

        if (timeRemaining > 0) {
          this.scheduleGiveawayEnd(giveaway.id, timeRemaining);
        } else {
          // End expired giveaways
          await this.endGiveaway(giveaway.id);
        }
      }
      
      logger.info(`Initialized ${activeGiveaways.rows.length} scheduled giveaways`);
    } catch (error) {
      logger.error('Error initializing scheduled giveaways', error as Error);
    }
  }

  public async leaveGiveaway(giveawayId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get giveaway details
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway) {
        return { success: false, message: 'Giveaway not found.' };
      }

      if (giveaway.ended || giveaway.cancelled) {
        return { success: false, message: 'This giveaway has already ended.' };
      }

      // Check if user is entered
      const existingEntry = await db.query(
        'SELECT id FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
        [giveawayId, userId]
      );

      if (existingEntry.rows.length === 0) {
        return { success: false, message: 'You are not entered in this giveaway.' };
      }

      // Remove entry
      await db.query(
        'DELETE FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
        [giveawayId, userId]
      );

      // Update entry count on the giveaway message with real-time updates
      await this.updateGiveawayMessageRealtime(giveawayId);

      logger.info('User left giveaway', { giveawayId, userId });

      return { 
        success: true, 
        message: 'Successfully left the giveaway.'
      };
    } catch (error) {
      logger.error('Error leaving giveaway', error as Error);
      return { success: false, message: 'An error occurred while leaving the giveaway.' };
    }
  }

  public async isUserEntered(giveawayId: string, userId: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT id FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
        [giveawayId, userId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking user entry status', error as Error);
      return false;
    }
  }

  public async getGiveawayEntryCount(giveawayId: string): Promise<number> {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = $1',
        [giveawayId]
      );
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('Error getting giveaway entry count', error as Error);
      return 0;
    }
  }

  public async getUserEntry(giveawayId: string, userId: string): Promise<GiveawayEntry | null> {
    try {
      const result = await db.query(
        'SELECT * FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
        [giveawayId, userId]
      );
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        id: row.id,
        giveawayId: row.giveaway_id,
        userId: row.user_id,
        entryCount: row.entry_count,
        entryTime: new Date(row.entry_time || row.created_at),
        bonusReason: row.bonus_reason
      };
    } catch (error) {
      logger.error('Error getting user entry', error as Error);
      return null;
    }
  }

  public async getGiveawayEntries(giveawayId: string): Promise<GiveawayEntry[]> {
    try {
      const result = await db.query(
        'SELECT * FROM giveaway_entries WHERE giveaway_id = $1 ORDER BY entry_count DESC, created_at ASC',
        [giveawayId]
      );
      
      return result.rows.map((row: any) => ({
        id: row.id,
        giveawayId: row.giveaway_id,
        userId: row.user_id,
        entryCount: row.entry_count,
        entryTime: new Date(row.entry_time || row.created_at),
        bonusReason: row.bonus_reason
      }));
    } catch (error) {
      logger.error('Error getting giveaway entries', error as Error);
      return [];
    }
  }

  public async getGiveawayWinners(giveawayId: string): Promise<GiveawayWinner[]> {
    try {
      const result = await db.query(
        'SELECT * FROM giveaway_winners WHERE giveaway_id = $1 AND rerolled = false ORDER BY selected_at ASC',
        [giveawayId]
      );
      
      return result.rows.map((row: any) => ({
        id: row.id,
        giveawayId: row.giveaway_id,
        userId: row.user_id,
        claimed: row.claimed || false,
        claimTime: row.claim_time ? new Date(row.claim_time) : undefined,
        rerolled: row.rerolled || false,
        selectedAt: new Date(row.selected_at || row.created_at)
      }));
    } catch (error) {
      logger.error('Error getting giveaway winners', error as Error);
      return [];
    }
  }

  public async cancelGiveaway(giveawayId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway) {
        return { success: false, message: 'Giveaway not found.' };
      }

      if (giveaway.ended || giveaway.cancelled) {
        return { success: false, message: 'This giveaway has already ended or been cancelled.' };
      }

      // Mark giveaway as cancelled
      await db.query(
        'UPDATE giveaways SET cancelled = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [giveawayId]
      );

      // Update the giveaway message
      await this.updateCancelledGiveawayMessage(giveaway, reason);

      // Clear scheduled end
      if (this.activeGiveaways.has(giveawayId)) {
        clearTimeout(this.activeGiveaways.get(giveawayId)!);
        this.activeGiveaways.delete(giveawayId);
      }

      logger.audit('GIVEAWAY_CANCELLED', 'system', giveaway.guildId, {
        giveawayId,
        reason: reason || 'No reason provided'
      });

      return { success: true, message: 'Giveaway has been cancelled successfully.' };
    } catch (error) {
      logger.error('Error cancelling giveaway', error as Error);
      return { success: false, message: 'An error occurred while cancelling the giveaway.' };
    }
  }

  public async updateGiveawayDetails(
    giveawayId: string, 
    updates: Partial<Pick<Giveaway, 'title' | 'description' | 'prize' | 'winnerCount'>>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway) {
        return { success: false, message: 'Giveaway not found.' };
      }

      if (giveaway.ended) {
        return { success: false, message: 'Cannot edit an ended giveaway.' };
      }

      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        updateFields.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }

      if (updates.prize !== undefined) {
        updateFields.push(`prize = $${paramIndex++}`);
        values.push(updates.prize);
      }

      if (updates.winnerCount !== undefined) {
        updateFields.push(`winner_count = $${paramIndex++}`);
        values.push(updates.winnerCount);
      }

      if (updateFields.length === 0) {
        return { success: false, message: 'No valid updates provided.' };
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(giveawayId);

      await db.query(
        `UPDATE giveaways SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      // Refresh and update the message
      const updatedGiveaway = await this.getGiveaway(giveawayId);
      if (updatedGiveaway && updatedGiveaway.messageId) {
        await this.updateGiveawayMessage(updatedGiveaway, []);
      }

      logger.audit('GIVEAWAY_UPDATED', 'system', giveaway.guildId, {
        giveawayId,
        updates
      });

      return { success: true, message: 'Giveaway details updated successfully.' };
    } catch (error) {
      logger.error('Error updating giveaway details', error as Error);
      return { success: false, message: 'An error occurred while updating the giveaway.' };
    }
  }

  public async addUserEntry(giveawayId: string, userId: string, entryCount: number = 1, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway) {
        return { success: false, message: 'Giveaway not found.' };
      }

      if (giveaway.ended || giveaway.cancelled) {
        return { success: false, message: 'Cannot add entries to an ended or cancelled giveaway.' };
      }

      // Check if user already has an entry
      const existingEntry = await db.query(
        'SELECT entry_count FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
        [giveawayId, userId]
      );

      if (existingEntry.rows.length > 0) {
        // Update existing entry
        await db.query(
          'UPDATE giveaway_entries SET entry_count = entry_count + $1, bonus_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE giveaway_id = $3 AND user_id = $4',
          [entryCount, reason, giveawayId, userId]
        );
      } else {
        // Create new entry
        await db.query(
          `INSERT INTO giveaway_entries (giveaway_id, user_id, entry_count, bonus_reason, entry_metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            giveawayId, 
            userId, 
            entryCount, 
            reason,
            JSON.stringify({
              enteredAt: new Date(),
              addedManually: true
            })
          ]
        );
      }

      // Update entry count on the giveaway message
      await this.updateEntryCount(giveaway);

      logger.info('User entry added manually', { giveawayId, userId, entryCount, reason });

      return { success: true, message: `Added ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} for user.` };
    } catch (error) {
      logger.error('Error adding user entry', error as Error);
      return { success: false, message: 'An error occurred while adding the entry.' };
    }
  }

  public async removeUserEntry(giveawayId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway) {
        return { success: false, message: 'Giveaway not found.' };
      }

      const result = await db.query(
        'DELETE FROM giveaway_entries WHERE giveaway_id = $1 AND user_id = $2',
        [giveawayId, userId]
      );

      if (result.rowCount === 0) {
        return { success: false, message: 'User entry not found.' };
      }

      // Update entry count on the giveaway message
      await this.updateEntryCount(giveaway);

      logger.info('User entry removed manually', { giveawayId, userId });

      return { success: true, message: 'User entry removed successfully.' };
    } catch (error) {
      logger.error('Error removing user entry', error as Error);
      return { success: false, message: 'An error occurred while removing the entry.' };
    }
  }

  public async updateGiveawayRequirements(giveawayId: string, requirements: GiveawayRequirements): Promise<{ success: boolean; message: string }> {
    try {
      const giveaway = await this.getGiveaway(giveawayId);
      if (!giveaway) {
        return { success: false, message: 'Giveaway not found.' };
      }

      if (giveaway.ended) {
        return { success: false, message: 'Cannot edit requirements for an ended giveaway.' };
      }

      await db.query(
        'UPDATE giveaways SET requirements = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(requirements), giveawayId]
      );

      logger.audit('GIVEAWAY_REQUIREMENTS_UPDATED', 'system', giveaway.guildId, {
        giveawayId,
        requirements
      });

      return { success: true, message: 'Giveaway requirements updated successfully.' };
    } catch (error) {
      logger.error('Error updating giveaway requirements', error as Error);
      return { success: false, message: 'An error occurred while updating requirements.' };
    }
  }

  private async updateCancelledGiveawayMessage(giveaway: Giveaway & { embed_config?: any }, reason?: string): Promise<void> {
    if (!giveaway.messageId) return;

    try {
      const guild = global.client?.guilds.cache.get(giveaway.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.messageId);
      if (!message) return;

      const embed = new EmbedBuilder()
        .setTitle(`🚫 ${giveaway.title}`)
        .setDescription(giveaway.description || 'This giveaway has been cancelled.')
        .setColor(0x95a5a6)
        .addFields([
          { name: '🎁 Prize', value: giveaway.prize, inline: true },
          { name: '👑 Winners', value: giveaway.winnerCount.toString(), inline: true },
          { name: '🚫 Status', value: 'Cancelled', inline: true }
        ]);

      if (reason) {
        embed.addFields([{ name: '📝 Reason', value: reason, inline: false }]);
      }

      embed.setFooter({ text: `Hosted by ${giveaway.hostId} • ID: ${giveaway.id}` });

      await message.edit({
        embeds: [embed],
        components: [] // Remove all buttons
      });

    } catch (error) {
      logger.error('Error updating cancelled giveaway message', error as Error);
    }
  }

  /**
   * Create admin management panel components for a giveaway
   */
  public createAdminManagementComponents(giveawayId: string, giveaway: Giveaway): ActionRowBuilder<StringSelectMenuBuilder>[] {
    const managementOptions = [];

    // Always available options
    managementOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel('📊 View Entries')
        .setDescription('View all giveaway participants')
        .setValue('view_entries')
        .setEmoji('📊'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📥 Export Data')
        .setDescription('Export participant data as CSV')
        .setValue('export_data')
        .setEmoji('📥')
    );

    // Options available only for active giveaways
    if (!giveaway.ended && !giveaway.cancelled) {
      managementOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel('✏️ Edit Details')
          .setDescription('Edit title, description, prize, winners')
          .setValue('edit_details')
          .setEmoji('✏️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('📋 Edit Requirements')
          .setDescription('Change entry requirements')
          .setValue('edit_requirements')
          .setEmoji('📋'),
        new StringSelectMenuOptionBuilder()
          .setLabel('👥 Manage Entries')
          .setDescription('Add or remove specific user entries')
          .setValue('manage_entries')
          .setEmoji('👥'),
        new StringSelectMenuOptionBuilder()
          .setLabel('⏰ End Early')
          .setDescription('End the giveaway now and select winners')
          .setValue('end_early')
          .setEmoji('⏰'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🗑️ Cancel Giveaway')
          .setDescription('Cancel the giveaway (no winners)')
          .setValue('cancel_giveaway')
          .setEmoji('🗑️')
      );
    }

    // Options available only for ended giveaways
    if (giveaway.ended) {
      managementOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel('🔄 Reroll Winners')
          .setDescription('Select new winners')
          .setValue('reroll')
          .setEmoji('🔄')
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`giveaway_manage_${giveawayId}`)
      .setPlaceholder('⚙️ Select a management action...')
      .addOptions(managementOptions)
      .setMinValues(1)
      .setMaxValues(1);

    return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)];
  }

  /**
   * Create enhanced giveaway buttons with leave option
   */
  public async createGiveawayButtons(giveawayId: string, showLeaveButton: boolean = false): Promise<ActionRowBuilder<ButtonBuilder>[]> {
    const entryCount = await this.getGiveawayEntryCount(giveawayId);
    
    const buttons = [
      new ButtonBuilder()
        .setCustomId(`giveaway_enter_${giveawayId}`)
        .setLabel(`🎉 Enter (${entryCount})`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`giveaway_info_${giveawayId}`)
        .setLabel('ℹ️ Info')
        .setStyle(ButtonStyle.Secondary)
    ];

    if (showLeaveButton) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`giveaway_leave_${giveawayId}`)
          .setLabel('👋 Leave')
          .setStyle(ButtonStyle.Danger)
      );
    }

    return [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)];
  }

  /**
   * Update giveaway message with real-time entry count
   */
  public async updateGiveawayMessageRealtime(giveawayId: string): Promise<void> {
    const giveaway = await this.getGiveaway(giveawayId);
    if (!giveaway || !giveaway.messageId || giveaway.ended) return;

    try {
      const guild = global.client?.guilds.cache.get(giveaway.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.messageId);
      if (!message) return;

      // Get current entry count
      const entryCount = await this.getGiveawayEntryCount(giveawayId);
      
      // Update embed with current stats
      const embed = this.createGiveawayEmbed(giveaway);
      
      // Add entry count field
      if (entryCount > 0) {
        embed.addFields([{
          name: '📊 Current Entries',
          value: entryCount.toString(),
          inline: true
        }]);
      }

      // Update buttons with current entry count
      const buttons = await this.createGiveawayButtons(giveawayId);

      await message.edit({
        embeds: [embed],
        components: buttons
      });

    } catch (error) {
      logger.error('Error updating giveaway message realtime', error as Error);
    }
  }
  
  public async getGiveawayStats(guildId: string): Promise<any> {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_giveaways,
          COUNT(CASE WHEN ended = true THEN 1 END) as ended_giveaways,
          COUNT(CASE WHEN ended = false AND cancelled = false THEN 1 END) as active_giveaways,
          COUNT(CASE WHEN cancelled = true THEN 1 END) as cancelled_giveaways,
          SUM(winner_count) as total_winners_selected,
          (SELECT COUNT(DISTINCT user_id) FROM giveaway_entries WHERE giveaway_id IN 
            (SELECT id FROM giveaways WHERE guild_id = $1)) as unique_participants,
          (SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id IN 
            (SELECT id FROM giveaways WHERE guild_id = $1)) as total_entries
        FROM giveaways
        WHERE guild_id = $1
      `, [guildId]);
      
      return stats.rows[0];
    } catch (error) {
      logger.error('Error getting giveaway stats', error as Error);
      return null;
    }
  }
}

export const giveawayHandler = new GiveawayHandler();