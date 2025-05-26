// src/modules/giveaways/GiveawayManager.ts - Fixed Giveaway System
import {
  Guild,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User,
  ButtonInteraction
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
  active: boolean;
  ended: boolean;
  winnerUserIds: string[];
  requiredRole?: string;
  requiredLevel?: number;
  createdAt: Date;
  updatedAt: Date;
  entries: GiveawayEntryData[];
}

export interface GiveawayEntryData {
  id: number;
  giveawayId: number;
  userId: string;
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
    this.startExpirationTimer();
  }

  async createGiveaway(guild: Guild, options: GiveawayOptions): Promise<{ success: boolean; giveaway?: GiveawayData; error?: string }> {
    try {
      if (options.duration < Config.GIVEAWAY.MIN_DURATION) {
        return { success: false, error: 'Giveaway duration must be at least 10 minutes' };
      }

      const channel = guild.channels.cache.get(options.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Invalid channel' };
      }

      const endTime = new Date(Date.now() + options.duration);

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
          requiredRole: options.requirements?.roleRequired,
          requiredLevel: options.requirements?.levelRequired,
          active: true,
          ended: false,
          winnerUserIds: []
        },
        include: {
          entries: true
        }
      });

      const embed = this.createGiveawayEmbed(giveaway as unknown as GiveawayData);
      const components = this.createGiveawayComponents(giveaway as unknown as GiveawayData);

      const message = await channel.send({ embeds: [embed], components });

      await this.db.giveaway.update({
        where: { id: giveaway.id },
        data: { messageId: message.id }
      });

      this.setExpirationTimer(giveaway.id, endTime);

      this.logger.info(`Giveaway created in ${guild.name} by ${options.creatorId}: ${options.title}`);

      return { success: true, giveaway: { ...giveaway, messageId: message.id } as unknown as GiveawayData };

    } catch (error) {
      this.logger.error('Error creating giveaway:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  async endGiveaway(giveawayId: number, moderatorId?: string): Promise<{ success: boolean; winners?: User[]; error?: string }> {
    try {
      const giveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (!giveaway || !giveaway.active || giveaway.ended) {
        return { success: false, error: 'Giveaway not found or already ended' };
      }

      const winners = await this.selectWinners(giveaway as unknown as GiveawayData);

      await this.db.giveaway.update({
        where: { id: giveawayId },
        data: {
          active: false,
          ended: true,
          winnerUserIds: winners.map(w => w.id),
          updatedAt: new Date()
        }
      });

      if (this.activeTimers.has(giveawayId)) {
        clearTimeout(this.activeTimers.get(giveawayId)!);
        this.activeTimers.delete(giveawayId);
      }

      const updatedGiveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (updatedGiveaway) {
        await this.updateGiveawayMessage(updatedGiveaway as unknown as GiveawayData);
        await this.announceWinners(updatedGiveaway as unknown as GiveawayData, winners);
      }

      this.logger.info(`Giveaway ${giveawayId} ended, ${winners.length} winners selected`);
      return { success: true, winners };

    } catch (error) {
      this.logger.error('Error ending giveaway:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  async rerollGiveaway(giveawayId: number, moderatorId: string): Promise<{ success: boolean; winners?: User[]; error?: string }> {
    try {
      const giveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (!giveaway || !giveaway.ended) {
        return { success: false, error: 'Giveaway not found or not ended' };
      }

      const winners = await this.selectWinners(giveaway as unknown as GiveawayData);

      await this.db.giveaway.update({
        where: { id: giveawayId },
        data: {
          winnerUserIds: winners.map(w => w.id),
          updatedAt: new Date()
        }
      });

      const updatedGiveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (updatedGiveaway) {
        await this.updateGiveawayMessage(updatedGiveaway as unknown as GiveawayData);
        await this.announceWinners(updatedGiveaway as unknown as GiveawayData, winners, true);
      }

      this.logger.info(`Giveaway ${giveawayId} rerolled by ${moderatorId}`);
      return { success: true, winners };

    } catch (error) {
      this.logger.error('Error rerolling giveaway:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  async handleEntry(interaction: ButtonInteraction): Promise<void> {
    try {
      if (!interaction.guild) return;

      const giveawayId = parseInt(interaction.customId.split('_')[1]);
      const giveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (!giveaway || !giveaway.active || giveaway.ended) {
        await interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true });
        return;
      }

      if (giveaway.endTime < new Date()) {
        await this.endGiveaway(giveawayId);
        void interaction.reply({ content: 'This giveaway has expired.', ephemeral: true });
      }

      const existingEntry = giveaway.entries.find(entry => entry.userId === interaction.user.id);
      if (existingEntry) {
        await interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
        return;
      }

      const requirementCheck = await this.checkRequirements(interaction.guild, interaction.user, giveaway as unknown as GiveawayData);
      if (!requirementCheck.eligible) {
        await interaction.reply({ content: requirementCheck.reason!, ephemeral: true });
        return;
      }

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

      const updatedGiveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });
      
      if (updatedGiveaway) {
        await this.updateGiveawayMessage(updatedGiveaway as unknown as GiveawayData);
      }

    } catch (error) {
      this.logger.error('Error handling giveaway entry:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your entry.', 
        ephemeral: true 
      });
    }
  }

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
      return giveaways as unknown as GiveawayData[];
    } catch (error) {
      this.logger.error('Error getting active giveaways:', error);
      return [];
    }
  }

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

  private async checkRequirements(guild: Guild, user: User, giveaway: GiveawayData): Promise<{ eligible: boolean; reason?: string }> {
    try {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        return { eligible: false, reason: 'You must be a member of this server to enter.' };
      }

      if (giveaway.requiredRole) {
        const hasRole = member.roles.cache.has(giveaway.requiredRole);
        if (!hasRole) {
          const role = guild.roles.cache.get(giveaway.requiredRole);
          return { 
            eligible: false, 
            reason: `You need the ${role?.name || 'required'} role to enter this giveaway.` 
          };
        }
      }

      if (giveaway.requiredLevel) {
        const userLevel = await this.db.userLevel.findUnique({
          where: {
            userId_guildId: {
              userId: user.id,
              guildId: guild.id
            }
          }
        });

        if (!userLevel || userLevel.level < giveaway.requiredLevel) {
          return { 
            eligible: false, 
            reason: `You need to be level ${giveaway.requiredLevel} or higher to enter this giveaway.` 
          };
        }
      }

      return { eligible: true };
    } catch (error) {
      this.logger.error('Error checking giveaway requirements:', error);
      return { eligible: false, reason: 'Error checking requirements.' };
    }
  }

  private async selectWinners(giveaway: GiveawayData): Promise<User[]> {
    const entries = giveaway.entries;
    const winners: User[] = [];

    if (entries.length === 0) return winners;

    const winnerCount = Math.min(giveaway.winners, entries.length);
    const selectedEntries = new Set<number>();

    while (selectedEntries.size < winnerCount) {
      const randomIndex = Math.floor(Math.random() * entries.length);
      selectedEntries.add(randomIndex);
    }

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

    if (giveaway.requiredRole || giveaway.requiredLevel) {
      const reqText = [];
      if (giveaway.requiredRole) {
        reqText.push(`Role: <@&${giveaway.requiredRole}>`);
      }
      if (giveaway.requiredLevel) {
        reqText.push(`Level: ${giveaway.requiredLevel}+`);
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

  private setExpirationTimer(giveawayId: number, endTime: Date): void {
    const delay = endTime.getTime() - Date.now();
    
    if (delay <= 0) {
      this.endGiveaway(giveawayId);
      return;
    }

    const timer = setTimeout(() => {
      this.endGiveaway(giveawayId);
    }, delay);

    this.activeTimers.set(giveawayId, timer);
  }

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
    }, 60000);
  }

  async initializeGuild(guild: Guild): Promise<void> {
    try {
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
}