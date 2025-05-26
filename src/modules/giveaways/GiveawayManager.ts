// src/modules/giveaways/GiveawayManager.ts - Giveaway System
import {
  Guild,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User,
  ButtonInteraction,
  GuildMember
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../../utils/Logger.js';
import { Config } from '../../config/Config.js';
import { ExtendedClient } from '../../index.js';

export interface GiveawayOptions {
  title: string;
  description?: string;
  prize: string;
  duration: number; // in milliseconds
  winners: number;
  creatorId: string;
  channelId: string;
  requirements?: {
    roleRequired?: string;
    levelRequired?: number;
    joinedBefore?: Date;
  };
}

export interface GiveawayData {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  title: string;
  description?: string;
  prize: string;
  winners: number;
  creatorId: string;
  endTime: Date;
  requirements: any;
  active: boolean;
  ended: boolean;
  winnerUserIds: string[];
  createdAt: Date;
  updatedAt: Date;
  entries: GiveawayEntryData[];
}

export interface GiveawayEntryData {
  id: number;
  giveawayId: number;
  userId: string;
  createdAt: Date;
}

export class GiveawayManager {
  private client: ExtendedClient;
  private db: PrismaClient;
  private logger: Logger;
  private activeTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(client: ExtendedClient, db: PrismaClient, logger: Logger) {
    this.client = client;
    this.db = db;
    this.logger = logger;

    // Start timer for checking expired giveaways
    this.startExpirationTimer();
  }

  /**
   * Create a new giveaway
   */
  async createGiveaway(guild: Guild, options: GiveawayOptions): Promise<{ success: boolean; giveaway?: GiveawayData; error?: string }> {
    try {
      // Validate options
      if (options.duration < Config.GIVEAWAY.MIN_DURATION) {
        return { success: false, error: 'Giveaway duration must be at least 10 minutes' };
      }

      if (options.duration > Config.GIVEAWAY.MAX_DURATION) {
        return { success: false, error: 'Giveaway duration cannot exceed 30 days' };
      }

      if (options.winners < 1 || options.winners > Config.GIVEAWAY.MAX_WINNERS) {
        return { success: false, error: `Winner count must be between 1 and ${Config.GIVEAWAY.MAX_WINNERS}` };
      }

      const channel = guild.channels.cache.get(options.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Invalid channel' };
      }

      // Calculate end time
      const endTime = new Date(Date.now() + options.duration);

      // Create giveaway in database
      const giveaway = await this.db.giveaway.create({
        data: {
          guildId: guild.id,
          channelId: options.channelId,
          title: options.title,
          description: options.description,
          prize: options.prize,
          winners: options.winners,
          creatorId: options.creatorId,
          endTime,
          requirements: options.requirements || {},
          active: true,
          ended: false,
          winnerUserIds: []
        },
        include: {
          entries: true
        }
      });

      // Create and send giveaway message
      const embed = this.createGiveawayEmbed(giveaway as GiveawayData);
      const components = this.createGiveawayComponents(giveaway as GiveawayData);

      const message = await channel.send({ embeds: [embed], components });

      // Update giveaway with message ID
      await this.db.giveaway.update({
        where: { id: giveaway.id },
        data: { messageId: message.id }
      });

      // Set expiration timer
      this.setExpirationTimer(giveaway.id, endTime);

      // Log the action
      await this.logGiveawayAction(guild.id, 'GIVEAWAY_CREATED', { ...giveaway, messageId: message.id } as GiveawayData);

      this.logger.info(`Giveaway created in ${guild.name} by ${options.creatorId}: ${options.title}`);

      return { success: true, giveaway: { ...giveaway, messageId: message.id } as GiveawayData };

    } catch (error) {
      this.logger.error('Error creating giveaway:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * End a giveaway and select winners
   */
  async endGiveaway(giveawayId: number, moderatorId?: string): Promise<{ success: boolean; winners?: User[]; error?: string }> {
    try {
      const giveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (!giveaway) {
        return { success: false, error: 'Giveaway not found' };
      }

      if (!giveaway.active || giveaway.ended) {
        return { success: false, error: 'Giveaway is already ended' };
      }

      // Select winners
      const winners = await this.selectWinners(giveaway as GiveawayData);

      // Update giveaway
      await this.db.giveaway.update({
        where: { id: giveawayId },
        data: {
          active: false,
          ended: true,
          winnerUserIds: winners.map(w => w.id),
          updatedAt: new Date()
        }
      });

      // Clear expiration timer
      if (this.activeTimers.has(giveawayId)) {
        clearTimeout(this.activeTimers.get(giveawayId)!);
        this.activeTimers.delete(giveawayId);
      }

      // Update giveaway message
      const updatedGiveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (updatedGiveaway) {
        await this.updateGiveawayMessage(updatedGiveaway as GiveawayData);
        await this.announceWinners(updatedGiveaway as GiveawayData, winners);
      }

      // Log the action
      await this.logGiveawayAction(giveaway.guildId, 'GIVEAWAY_ENDED', giveaway as GiveawayData, moderatorId);

      this.logger.info(`Giveaway ${giveawayId} ended in guild ${giveaway.guildId}, ${winners.length} winners selected`);

      return { success: true, winners };

    } catch (error) {
      this.logger.error('Error ending giveaway:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Reroll giveaway winners
   */
  async rerollGiveaway(giveawayId: number, moderatorId: string): Promise<{ success: boolean; winners?: User[]; error?: string }> {
    try {
      const giveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (!giveaway) {
        return { success: false, error: 'Giveaway not found' };
      }

      if (!giveaway.ended) {
        return { success: false, error: 'Giveaway must be ended before rerolling' };
      }

      // Select new winners
      const winners = await this.selectWinners(giveaway as GiveawayData);

      // Update giveaway with new winners
      await this.db.giveaway.update({
        where: { id: giveawayId },
        data: {
          winnerUserIds: winners.map(w => w.id),
          updatedAt: new Date()
        }
      });

      // Update giveaway message
      const updatedGiveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (updatedGiveaway) {
        await this.updateGiveawayMessage(updatedGiveaway as GiveawayData);
        await this.announceWinners(updatedGiveaway as GiveawayData, winners, true);
      }

      // Log the action
      await this.logGiveawayAction(giveaway.guildId, 'GIVEAWAY_REROLLED', giveaway as GiveawayData, moderatorId);

      this.logger.info(`Giveaway ${giveawayId} rerolled by ${moderatorId}, ${winners.length} new winners selected`);

      return { success: true, winners };

    } catch (error) {
      this.logger.error('Error rerolling giveaway:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Handle giveaway entry
   */
  async handleEntry(interaction: ButtonInteraction): Promise<void> {
    try {
      if (!interaction.guild) return;

      const customId = interaction.customId;
      const giveawayId = parseInt(customId.split('_')[1]);

      const giveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (!giveaway || !giveaway.active || giveaway.ended) {
        return interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true });
      }

      // Check if giveaway has expired
      if (giveaway.endTime < new Date()) {
        await this.endGiveaway(giveawayId);
        return interaction.reply({ content: 'This giveaway has expired.', ephemeral: true });
      }

      // Check if user already entered
      const existingEntry = giveaway.entries.find(entry => entry.userId === interaction.user.id);
      if (existingEntry) {
        return interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
      }

      // Check requirements
      const requirementCheck = await this.checkRequirements(interaction.guild, interaction.user, giveaway as GiveawayData);
      if (!requirementCheck.eligible) {
        return interaction.reply({ content: requirementCheck.reason!, ephemeral: true });
      }

      // Add entry
      await this.db.giveawayEntry.create({
        data: {
          giveawayId: giveawayId,
          userId: interaction.user.id
        }
      });

      await interaction.reply({ 
        content: `${Config.EMOJIS.SUCCESS} You have successfully entered the giveaway for **${giveaway.prize}**!`, 
        ephemeral: true 
      });

      // Update giveaway message
      const updatedGiveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });
      
      if (updatedGiveaway) {
        await this.updateGiveawayMessage(updatedGiveaway as GiveawayData);
      }

    } catch (error) {
      this.logger.error('Error handling giveaway entry:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your entry.', 
        ephemeral: true 
      });
    }
  }

  /**
   * Get giveaway data by ID
   */
  async getGiveaway(giveawayId: number): Promise<GiveawayData | null> {
    try {
      const giveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      return giveaway as GiveawayData | null;
    } catch (error) {
      this.logger.error('Error getting giveaway:', error);
      return null;
    }
  }

  /**
   * Get active giveaways for a guild
   */
  async getActiveGiveaways(guildId: string): Promise<GiveawayData[]> {
    try {
      const giveaways = await this.db.giveaway.findMany({
        where: {
          guildId,
          active: true,
          ended: false
        },
        include: { entries: true },
        orderBy: { createdAt: 'desc' }
      });

      return giveaways as GiveawayData[];
    } catch (error) {
      this.logger.error('Error getting active giveaways:', error);
      return [];
    }
  }

  /**
   * Get giveaway participants
   */
  async getGiveawayParticipants(giveawayId: number): Promise<User[]> {
    try {
      const entries = await this.db.giveawayEntry.findMany({
        where: { giveawayId }
      });

      const users: User[] = [];
      for (const entry of entries) {
        try {
          const user = await this.client.users.fetch(entry.userId);
          users.push(user);
        } catch (error) {
          this.logger.warn(`Failed to fetch user ${entry.userId}:`, error);
        }
      }

      return users;
    } catch (error) {
      this.logger.error('Error getting giveaway participants:', error);
      return [];
    }
  }

  /**
   * Check if user meets giveaway requirements
   */
  private async checkRequirements(guild: Guild, user: User, giveaway: GiveawayData): Promise<{ eligible: boolean; reason?: string }> {
    try {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        return { eligible: false, reason: 'You must be a member of this server to enter.' };
      }

      const requirements = giveaway.requirements as any;
      if (!requirements) {
        return { eligible: true };
      }

      // Check role requirement
      if (requirements.roleRequired) {
        const hasRole = member.roles.cache.has(requirements.roleRequired);
        if (!hasRole) {
          const role = guild.roles.cache.get(requirements.roleRequired);
          return { 
            eligible: false, 
            reason: `You need the ${role?.name || 'required'} role to enter this giveaway.` 
          };
        }
      }

      // Check level requirement
      if (requirements.levelRequired) {
        const userLevel = await this.db.userLevel.findUnique({
          where: {
            userId_guildId: {
              userId: user.id,
              guildId: guild.id
            }
          }
        });

        if (!userLevel || userLevel.level < requirements.levelRequired) {
          return { 
            eligible: false, 
            reason: `You need to be level ${requirements.levelRequired} or higher to enter this giveaway.` 
          };
        }
      }

      // Check join date requirement
      if (requirements.joinedBefore) {
        const joinedBefore = new Date(requirements.joinedBefore);
        if (member.joinedAt && member.joinedAt > joinedBefore) {
          return { 
            eligible: false, 
            reason: `You must have joined the server before ${joinedBefore.toDateString()} to enter this giveaway.` 
          };
        }
      }

      return { eligible: true };

    } catch (error) {
      this.logger.error('Error checking giveaway requirements:', error);
      return { eligible: false, reason: 'Error checking requirements.' };
    }
  }

  /**
   * Select random winners from entries
   */
  private async selectWinners(giveaway: GiveawayData): Promise<User[]> {
    const entries = giveaway.entries;
    const winners: User[] = [];

    if (entries.length === 0) {
      return winners;
    }

    const winnerCount = Math.min(giveaway.winners, entries.length);
    const selectedEntries = new Set<number>();

    // Randomly select winner indices
    while (selectedEntries.size < winnerCount) {
      const randomIndex = Math.floor(Math.random() * entries.length);
      selectedEntries.add(randomIndex);
    }

    // Fetch winner users
    for (const index of selectedEntries) {
      try {
        const entry = entries[index];
        const user = await this.client.users.fetch(entry.userId);
        winners.push(user);
      } catch (error) {
        this.logger.warn(`Failed to fetch winner user ${entries[index].userId}:`, error);
      }
    }

    return winners;
  }

  /**
   * Create giveaway embed
   */
  private createGiveawayEmbed(giveaway: GiveawayData): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${Config.EMOJIS.GIVEAWAY} ${giveaway.title}`)
      .setColor(giveaway.ended ? Config.COLORS.ERROR : Config.COLORS.GIVEAWAY)
      .setTimestamp();

    if (giveaway.description) {
      embed.setDescription(giveaway.description);
    }

    embed.addFields(
      { name: 'Prize', value: giveaway.prize, inline: true },
      { name: 'Winners', value: giveaway.winners.toString(), inline: true },
      { name: 'Entries', value: giveaway.entries.length.toString(), inline: true }
    );

    if (!giveaway.ended) {
      embed.addFields({
        name: 'Ends',
        value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
        inline: false
      });
    } else {
      embed.setTitle(`${Config.EMOJIS.GIVEAWAY} ${giveaway.title} (ENDED)`);
      
      if (giveaway.winnerUserIds.length > 0) {
        const winnerMentions = giveaway.winnerUserIds.map(id => `<@${id}>`).join(', ');
        embed.addFields({
          name: 'Winners',
          value: winnerMentions,
          inline: false
        });
      } else {
        embed.addFields({
          name: 'Winners',
          value: 'No valid entries',
          inline: false
        });
      }
    }

    // Add requirements if any
    const requirements = giveaway.requirements as any;
    if (requirements && Object.keys(requirements).length > 0) {
      const reqText = [];
      if (requirements.roleRequired) {
        reqText.push(`Role: <@&${requirements.roleRequired}>`);
      }
      if (requirements.levelRequired) {
        reqText.push(`Level: ${requirements.levelRequired}+`);
      }
      if (requirements.joinedBefore) {
        const date = new Date(requirements.joinedBefore);
        reqText.push(`Joined before: ${date.toDateString()}`);
      }
      
      if (reqText.length > 0) {
        embed.addFields({
          name: 'Requirements',
          value: reqText.join('\n'),
          inline: false
        });
      }
    }

    return embed;
  }

  /**
   * Create giveaway components (entry button)
   */
  private createGiveawayComponents(giveaway: GiveawayData): ActionRowBuilder<ButtonBuilder>[] {
    if (giveaway.ended || !giveaway.active) {
      return [];
    }

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_${giveaway.id}`)
          .setLabel(`Enter Giveaway (${giveaway.entries.length})`)
          .setStyle(ButtonStyle.Success)
          .setEmoji(Config.GIVEAWAY.ENTRY_EMOJI)
      );

    return [row];
  }

  /**
   * Update giveaway message
   */
  private async updateGiveawayMessage(giveaway: GiveawayData): Promise<void> {
    try {
      if (!giveaway.messageId) return;

      const guild = this.client.guilds.cache.get(giveaway.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (!message) return;

      const embed = this.createGiveawayEmbed(giveaway);
      const components = this.createGiveawayComponents(giveaway);

      await message.edit({ embeds: [embed], components });

    } catch (error) {
      this.logger.error('Error updating giveaway message:', error);
    }
  }

  /**
   * Announce giveaway winners
   */
  private async announceWinners(giveaway: GiveawayData, winners: User[], isReroll = false): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(giveaway.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.GIVEAWAY} Giveaway ${isReroll ? 'Rerolled' : 'Ended'}!`)
        .setDescription(`**${giveaway.title}**`)
        .addFields(
          { name: 'Prize', value: giveaway.prize, inline: true },
          { name: 'Total Entries', value: giveaway.entries.length.toString(), inline: true }
        )
        .setColor(Config.COLORS.SUCCESS)
        .setTimestamp();

      if (winners.length > 0) {
        const winnerMentions = winners.map(winner => winner.toString()).join(', ');
        embed.addFields({
          name: `🎉 Winner${winners.length > 1 ? 's' : ''}`,
          value: winnerMentions,
          inline: false
        });

        await channel.send({ 
          content: `Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`,
          embeds: [embed] 
        });

        // Send DM to winners
        for (const winner of winners) {
          try {
            const dmEmbed = new EmbedBuilder()
              .setTitle(`${Config.EMOJIS.GIVEAWAY} Congratulations!`)
              .setDescription(`You won the giveaway in **${guild.name}**!`)
              .addFields(
                { name: 'Prize', value: giveaway.prize, inline: true },
                { name: 'Giveaway', value: giveaway.title, inline: true }
              )
              .setColor(Config.COLORS.SUCCESS)
              .setTimestamp();

            await winner.send({ embeds: [dmEmbed] });
          } catch (error) {
            this.logger.warn(`Failed to send DM to winner ${winner.tag}:`, error);
          }
        }
      } else {
        embed.addFields({
          name: '😔 No Winners',
          value: 'No valid entries were found.',
          inline: false
        });

        await channel.send({ embeds: [embed] });
      }

    } catch (error) {
      this.logger.error('Error announcing giveaway winners:', error);
    }
  }

  /**
   * Set expiration timer for giveaway
   */
  private setExpirationTimer(giveawayId: number, endTime: Date): void {
    const delay = endTime.getTime() - Date.now();
    
    if (delay <= 0) {
      // Already expired, process immediately
      this.endGiveaway(giveawayId);
      return;
    }

    const timer = setTimeout(() => {
      this.endGiveaway(giveawayId);
    }, delay);

    this.activeTimers.set(giveawayId, timer);
  }

  /**
   * Start timer to check for expired giveaways
   */
  private startExpirationTimer(): void {
    setInterval(async () => {
      try {
        const expiredGiveaways = await this.db.giveaway.findMany({
          where: {
            active: true,
            ended: false,
            endTime: {
              lte: new Date()
            }
          }
        });

        for (const giveaway of expiredGiveaways) {
          await this.endGiveaway(giveaway.id);
        }
      } catch (error) {
        this.logger.error('Error checking expired giveaways:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Log giveaway action
   */
  private async logGiveawayAction(
    guildId: string,
    action: 'GIVEAWAY_CREATED' | 'GIVEAWAY_ENDED' | 'GIVEAWAY_REROLLED',
    giveaway: GiveawayData,
    moderatorId?: string
  ): Promise<void> {
    try {
      const guildSettings = await this.db.guild.findUnique({
        where: { id: guildId }
      });

      if (!guildSettings?.modLogChannelId) {
        return;
      }

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return;

      const logChannel = guild.channels.cache.get(guildSettings.modLogChannelId) as TextChannel;
      if (!logChannel) return;

      const creator = await this.client.users.fetch(giveaway.creatorId).catch(() => null);
      const moderator = moderatorId ? await this.client.users.fetch(moderatorId).catch(() => null) : null;

      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.GIVEAWAY} Giveaway ${action.split('_')[1]}`)
        .addFields(
          { name: 'Giveaway', value: giveaway.title, inline: true },
          { name: 'Prize', value: giveaway.prize, inline: true },
          { name: 'Creator', value: creator ? `${creator.tag} (${creator.id})` : giveaway.creatorId, inline: true },
          { name: 'Channel', value: `<#${giveaway.channelId}>`, inline: true },
          { name: 'Entries', value: giveaway.entries.length.toString(), inline: true },
          { name: 'Winners', value: giveaway.winners.toString(), inline: true }
        )
        .setColor(
          action === 'GIVEAWAY_CREATED' ? Config.COLORS.SUCCESS :
          action === 'GIVEAWAY_ENDED' ? Config.COLORS.INFO :
          Config.COLORS.WARNING
        )
        .setTimestamp();

      if (moderator && action !== 'GIVEAWAY_CREATED') {
        embed.addFields({ name: `${action.split('_')[1]} by`, value: `${moderator.tag} (${moderator.id})`, inline: true });
      }

      if (action === 'GIVEAWAY_CREATED') {
        embed.addFields({ 
          name: 'End Time', 
          value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:F>`, 
          inline: true 
        });
      }

      if (action === 'GIVEAWAY_ENDED' && giveaway.winnerUserIds.length > 0) {
        const winnerMentions = giveaway.winnerUserIds.map(id => `<@${id}>`).join(', ');
        embed.addFields({ name: 'Winners', value: winnerMentions, inline: false });
      }

      await logChannel.send({ embeds: [embed] });

    } catch (error) {
      this.logger.error('Error logging giveaway action:', error);
    }
  }

  /**
   * Initialize giveaway system for guild
   */
  async initializeGuild(guild: Guild): Promise<void> {
    try {
      // Load active giveaways and set timers
      const activeGiveaways = await this.db.giveaway.findMany({
        where: {
          guildId: guild.id,
          active: true,
          ended: false
        }
      });

      for (const giveaway of activeGiveaways) {
        this.setExpirationTimer(giveaway.id, giveaway.endTime);
      }

      this.logger.info(`Initialized giveaway system for guild ${guild.name} with ${activeGiveaways.length} active giveaways`);

    } catch (error) {
      this.logger.error('Error initializing giveaway system for guild:', error);
    }
  }

  /**
   * Clean up old giveaways
   */
  async cleanup(): Promise<void> {
    try {
      // Clear all active timers
      for (const [giveawayId, timer] of this.activeTimers) {
        clearTimeout(timer);
      }
      this.activeTimers.clear();

      // Clean up old ended giveaways (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      await this.db.giveaway.deleteMany({
        where: {
          ended: true,
          updatedAt: {
            lt: thirtyDaysAgo
          }
        }
      });

      this.logger.info('Giveaway system cleanup completed');

    } catch (error) {
      this.logger.error('Error during giveaway cleanup:', error);
    }
  }
}