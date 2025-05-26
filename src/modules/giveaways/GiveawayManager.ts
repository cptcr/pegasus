async rerollGiveaway(giveawayId: number, moderatorId: string): Promise<{ success: boolean; winners?: User[]; error?: string }> {
    try {
      const giveaway = await this.db.giveaway.findUnique({
        where: { id: giveawayId },
        include: { entries: true }
      });

      if (!giveaway || !giveaway.ended) {
        return { success: false, error: 'Giveaway not found or not ended' };
      }

      const winners = await this.selectWinners(giveaway as GiveawayData);

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
        await this.updateGiveawayMessage(updatedGiveaway as GiveawayData);
        await this.announceWinners(updatedGiveaway as GiveawayData, winners, true);
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
        return interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true });
      }

      if (giveaway.endTime < new Date()) {
        await this.endGiveaway(giveawayId);
        return interaction.reply({ content: 'This giveaway has expired.', ephemeral: true });
      }

      const existingEntry = giveaway.entries.find(entry => entry.userId === interaction.user.id);
      if (existingEntry) {
        return interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
      }

      const requirementCheck = await this.checkRequirements(interaction.guild, interaction.user, giveaway as GiveawayData);
      if (!requirementCheck.eligible) {
        return interaction.reply({ content: requirementCheck.reason!, ephemeral: true });
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
      return giveaways as GiveawayData[];
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

// src/modules/polls/PollManager.ts - Updated for Dashboard Schema
import {
  Guild,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User,
  ButtonInteraction,
  Collection
} from 'discord.js';

export interface PollOptions {
  title: string;
  description?: string;
  options: string[];
  duration?: number;
  allowMultiple?: boolean;
  anonymous?: boolean;
  creatorId: string;
  channelId: string;
}

export interface PollData {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  title: string;
  description?: string;
  creatorId: string;
  multiple: boolean;
  anonymous: boolean;
  active: boolean;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  options: PollOptionData[];
  votes: PollVoteData[];
}

export interface PollOptionData {
  id: number;
  pollId: number;
  text: string;
  emoji?: string;
  orderIndex: number;
}

export interface PollVoteData {
  id: number;
  pollId: number;
  optionId: number;
  userId: string;
}

export class PollManager {
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

  async createPoll(guild: Guild, options: PollOptions): Promise<{ success: boolean; poll?: PollData; error?: string }> {
    try {
      if (options.options.length < 2) {
        return { success: false, error: 'Poll must have at least 2 options' };
      }

      if (options.options.length > Config.POLL.MAX_OPTIONS) {
        return { success: false, error: `Poll cannot have more than ${Config.POLL.MAX_OPTIONS} options` };
      }

      const channel = guild.channels.cache.get(options.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Invalid channel' };
      }

      const endTime = options.duration ? new Date(Date.now() + options.duration) : null;

      // Create poll with dashboard-compatible schema
      const poll = await this.db.poll.create({
        data: {
          guildId: guild.id,
          channelId: options.channelId,
          title: options.title,
          description: options.description,
          creatorId: options.creatorId,
          multiple: options.allowMultiple || false,
          anonymous: options.anonymous || false,
          active: true,
          endTime,
          options: {
            create: options.options.map((text, index) => ({
              text,
              emoji: Config.POLL.VOTE_EMOJIS[index] || `${index + 1}️⃣`,
              orderIndex: index
            }))
          }
        },
        include: {
          options: true,
          votes: true
        }
      });

      const embed = this.createPollEmbed(poll as PollData);
      const components = this.createPollComponents(poll as PollData);

      const message = await channel.send({ embeds: [embed], components });

      await this.db.poll.update({
        where: { id: poll.id },
        data: { messageId: message.id }
      });

      if (endTime) {
        this.setExpirationTimer(poll.id, endTime);
      }

      this.logger.info(`Poll created in ${guild.name} by ${options.creatorId}: ${options.title}`);

      return { success: true, poll: { ...poll, messageId: message.id } as PollData };

    } catch (error) {
      this.logger.error('Error creating poll:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  async endPoll(pollId: number, moderatorId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const poll = await this.db.poll.findUnique({
        where: { id: pollId },
        include: { options: true, votes: true }
      });

      if (!poll || !poll.active) {
        return { success: false, error: 'Poll not found or already ended' };
      }

      await this.db.poll.update({
        where: { id: pollId },
        data: { active: false, updatedAt: new Date() }
      });

      if (this.activeTimers.has(pollId)) {
        clearTimeout(this.activeTimers.get(pollId)!);
        this.activeTimers.delete(pollId);
      }

      await this.updatePollMessage(poll as PollData);

      this.logger.info(`Poll ${pollId} ended in guild ${poll.guildId}`);
      return { success: true };

    } catch (error) {
      this.logger.error('Error ending poll:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  async handleVote(interaction: ButtonInteraction): Promise<void> {
    try {
      if (!interaction.guild) return;

      const [, pollIdStr, optionIdStr] = interaction.customId.split('_');
      const pollId = parseInt(pollIdStr);
      const optionId = parseInt(optionIdStr);

      const poll = await this.db.poll.findUnique({
        where: { id: pollId },
        include: { options: true, votes: true }
      });

      if (!poll || !poll.active) {
        return interaction.reply({ content: 'This poll is no longer active.', ephemeral: true });
      }

      if (poll.endTime && poll.endTime < new Date()) {
        await this.endPoll(pollId);
        return interaction.reply({ content: 'This poll has expired.', ephemeral: true });
      }

      const option = poll.options.find(opt => opt.id === optionId);
      if (!option) {
        return interaction.reply({ content: 'Invalid poll option.', ephemeral: true });
      }

      const existingVotes = poll.votes.filter(vote => vote.userId === interaction.user.id);

      if (!poll.multiple && existingVotes.length > 0) {
        await this.db.pollVote.deleteMany({
          where: {
            pollId: pollId,
            userId: interaction.user.id
          }
        });
      } else if (poll.multiple) {
        const existingVoteForOption = existingVotes.find(vote => vote.optionId === optionId);
        if (existingVoteForOption) {
          await this.db.pollVote.delete({
            where: { id: existingVoteForOption.id }
          });
          
          await interaction.reply({ 
            content: `${Config.EMOJIS.SUCCESS} Your vote for "${option.text}" has been removed.`, 
            ephemeral: true 
          });
          
          const updatedPoll = await this.db.poll.findUnique({
            where: { id: pollId },
            include: { options: true, votes: true }
          });
          if (updatedPoll) {
            await this.updatePollMessage(updatedPoll as PollData);
          }
          return;
        }
      }

      await this.db.pollVote.create({
        data: {
          pollId: pollId,
          optionId: optionId,
          userId: interaction.user.id
        }
      });

      await interaction.reply({ 
        content: `${Config.EMOJIS.SUCCESS} Your vote for "${option.text}" has been recorded.`, 
        ephemeral: true 
      });

      const updatedPoll = await this.db.poll.findUnique({
        where: { id: pollId },
        include: { options: true, votes: true }
      });
      
      if (updatedPoll) {
        await this.updatePollMessage(updatedPoll as PollData);
      }

    } catch (error) {
      this.logger.error('Error handling poll vote:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your vote.', 
        ephemeral: true 
      });
    }
  }

  async getPoll(pollId: number): Promise<PollData | null> {
    try {
      const poll = await this.db.poll.findUnique({
        where: { id: pollId },
        include: { options: true, votes: true }
      });
      return poll as PollData | null;
    } catch (error) {
      this.logger.error('Error getting poll:', error);
      return null;
    }
  }

  async getActivePolls(guildId: string): Promise<PollData[]> {
    try {
      const polls = await this.db.poll.findMany({
        where: {
          guildId,
          active: true
        },
        include: { options: true, votes: true },
        orderBy: { createdAt: 'desc' }
      });
      return polls as PollData[];
    } catch (error) {
      this.logger.error('Error getting active polls:', error);
      return [];
    }
  }

  async getPollParticipants(pollId: number): Promise<User[]> {
    try {
      const votes = await this.db.pollVote.findMany({
        where: { pollId },
        distinct: ['userId']
      });

      const users: User[] = [];
      for (const vote of votes) {
        try {
          const user = await this.client.users.fetch(vote.userId);
          users.push(user);
        } catch (error) {
          this.logger.warn(`Failed to fetch user ${vote.userId}:`, error);
        }
      }
      return users;
    } catch (error) {
      this.logger.error('Error getting poll participants:', error);
      return [];
    }
  }

  private createPollEmbed(poll: PollData): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${Config.EMOJIS.POLL} ${poll.title}`)
      .setColor(Config.COLORS.POLL)
      .setTimestamp();

    if (poll.description) {
      embed.setDescription(poll.description);
    }

    const voteCounts = new Map<number, number>();
    poll.options.forEach(option => {
      voteCounts.set(option.id, 0);
    });

    poll.votes.forEach(vote => {
      const current = voteCounts.get(vote.optionId) || 0;
      voteCounts.set(vote.optionId, current + 1);
    });

    const totalVotes = poll.votes.length;
    const uniqueVoters = new Set(poll.votes.map(vote => vote.userId)).size;

    // Sort options by orderIndex for consistent display
    const sortedOptions = poll.options.sort((a, b) => a.orderIndex - b.orderIndex);

    for (const option of sortedOptions) {
      const votes = voteCounts.get(option.id) || 0;
      const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const progressBar = this.createProgressBar(percentage);
      
      embed.addFields({
        name: `${option.emoji} ${option.text}`,
        value: `${progressBar} ${votes} votes (${percentage}%)`,
        inline: false
      });
    }

    let footerText = `${uniqueVoters} participant(s) • ${totalVotes} vote(s)`;
    if (poll.multiple) {
      footerText += ' • Multiple choice';
    }
    if (poll.anonymous) {
      footerText += ' • Anonymous';
    }
    
    if (poll.endTime) {
      if (poll.active) {
        footerText += ` • Ends `;
        embed.setFooter({ text: footerText });
        embed.addFields({
          name: 'Ends',
          value: `<t:${Math.floor(poll.endTime.getTime() / 1000)}:R>`,
          inline: true
        });
      } else {
        footerText += ' • Ended';
        embed.setFooter({ text: footerText });
      }
    } else {
      embed.setFooter({ text: footerText });
    }

    if (!poll.active) {
      embed.setColor(Config.COLORS.ERROR);
      embed.setTitle(`${Config.EMOJIS.POLL} ${poll.title} (ENDED)`);
    }

    return embed;
  }

  private createPollComponents(poll: PollData): ActionRowBuilder<ButtonBuilder>[] {
    if (!poll.active) {
      return [];
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    let buttonCount = 0;

    // Sort options by orderIndex
    const sortedOptions = poll.options.sort((a, b) => a.orderIndex - b.orderIndex);

    for (const option of sortedOptions) {
      const button = new ButtonBuilder()
        .setCustomId(`poll_${poll.id}_${option.id}`)
        .setLabel(option.text)
        .setStyle(ButtonStyle.Primary);

      if (option.emoji) {
        button.setEmoji(option.emoji);
      }

      currentRow.addComponents(button);
      buttonCount++;

      if (buttonCount === 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
        buttonCount = 0;
      }
    }

    if (buttonCount > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  private createProgressBar(percentage: number, length = 10): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private async updatePollMessage(poll: PollData): Promise<void> {
    try {
      if (!poll.messageId) return;

      const guild = this.client.guilds.cache.get(poll.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(poll.channelId) as TextChannel;
      if (!channel) return;

      const message = await channel.messages.fetch(poll.messageId).catch(() => null);
      if (!message) return;

      const embed = this.createPollEmbed(poll);
      // src/modules/giveaways/GiveawayManager.ts - Updated for Dashboard Schema
import {
  Guild,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User,
  ButtonInteraction,
  Collection
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

      // Create giveaway with dashboard-compatible schema
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

      const embed = this.createGiveawayEmbed(giveaway as GiveawayData);
      const components = this.createGiveawayComponents(giveaway as GiveawayData);

      const message = await channel.send({ embeds: [embed], components });

      await this.db.giveaway.update({
        where: { id: giveaway.id },
        data: { messageId: message.id }
      });

      this.setExpirationTimer(giveaway.id, endTime);

      this.logger.info(`Giveaway created in ${guild.name} by ${options.creatorId}: ${options.title}`);

      return { success: true, giveaway: { ...giveaway, messageId: message.id } as GiveawayData };

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

      const winners = await this.selectWinners(giveaway as GiveawayData);

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
        await this.updateGiveawayMessage(updatedGiveaway as GiveawayData);
        await this.announceWinners(updatedGiveaway as GiveawayData, winners);
      }

      this.logger.info(`Giveaway ${giveawayId} ended, ${winners.length} winners selected`);
      return { success: true, winners };

    } catch (error) {
      this.logger.error('Error ending giveaway:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }
}} catch (error) {
      this.logger.error('Error updating poll message:', error);
    }
  }
}