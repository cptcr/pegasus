// src/modules/polls/PollManager.ts - Fixed Callback Type Issues
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

export interface PollOptions {
  title: string;
  description?: string;
  options: string[];
  duration?: number; // in milliseconds
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
  description?: string | null;
  creatorId: string;
  multiple: boolean;
  anonymous: boolean;
  active: boolean;
  endTime?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  options: PollOptionData[];
  votes: PollVoteData[];
}

export interface PollOptionData {
  id: number;
  pollId: number;
  text: string;
  emoji?: string | null;
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
  private logger: typeof Logger;
  private activeTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(client: ExtendedClient, db: PrismaClient, logger: typeof Logger) {
    this.client = client;
    this.db = db;
    this.logger = logger;

    // Start timer for checking expired polls
    this.startExpirationTimer();
  }

  /**
   * Create a new poll
   */
  async createPoll(guild: Guild, options: PollOptions): Promise<{ success: boolean; poll?: PollData; error?: string }> {
    try {
      // Validate options
      if (options.options.length < 2) {
        return { success: false, error: 'Poll must have at least 2 options' };
      }

      if (options.options.length > Config.POLL.MAX_OPTIONS) {
        return { success: false, error: `Poll cannot have more than ${Config.POLL.MAX_OPTIONS} options` };
      }

      if (options.duration && options.duration < Config.POLL.MIN_DURATION) {
        return { success: false, error: 'Poll duration must be at least 5 minutes' };
      }

      if (options.duration && options.duration > Config.POLL.MAX_DURATION) {
        return { success: false, error: 'Poll duration cannot exceed 7 days' };
      }

      const channel = guild.channels.cache.get(options.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Invalid channel' };
      }

      // Calculate end time
      const endTime = options.duration ? new Date(Date.now() + options.duration) : null;

      // Create poll in database
      const poll = await this.db.poll.create({
        data: {
          guildId: guild.id,
          channelId: options.channelId,
          title: options.title,
          description: options.description || null,
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

      // Create and send poll message
      const embed = this.createPollEmbed(poll as PollData);
      const components = this.createPollComponents(poll as PollData);

      const message = await channel.send({ embeds: [embed], components });

      // Update poll with message ID
      await this.db.poll.update({
        where: { id: poll.id },
        data: { messageId: message.id }
      });

      // Set expiration timer if duration is specified
      if (endTime) {
        this.setExpirationTimer(poll.id, endTime);
      }

      // Emit to dashboard
      this.client.wsManager.emitRealtimeEvent(guild.id, 'poll:created', {
        id: poll.id,
        title: poll.title,
        options: poll.options.length,
        endTime: endTime?.toISOString(),
        creatorId: poll.creatorId
      });

      this.logger.info(`Poll created in ${guild.name} by ${options.creatorId}: ${options.title}`);

      return { success: true, poll: { ...poll, messageId: message.id } as PollData };

    } catch (error) {
      this.logger.error('Error creating poll:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * End a poll manually
   */
  async endPoll(pollId: number, moderatorId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const poll = await this.db.poll.findUnique({
        where: { id: pollId },
        include: { options: true, votes: true }
      });

      if (!poll) {
        return { success: false, error: 'Poll not found' };
      }

      if (!poll.active) {
        return { success: false, error: 'Poll is already ended' };
      }

      // Mark poll as inactive
      await this.db.poll.update({
        where: { id: pollId },
        data: { active: false, updatedAt: new Date() }
      });

      // Clear expiration timer
      if (this.activeTimers.has(pollId)) {
        clearTimeout(this.activeTimers.get(pollId)!);
        this.activeTimers.delete(pollId);
      }

      // Update poll message
      await this.updatePollMessage(poll as PollData);

      // Emit to dashboard
      this.client.wsManager.emitRealtimeEvent(poll.guildId, 'poll:ended', {
        id: pollId,
        title: poll.title,
        totalVotes: poll.votes.length
      });

      this.logger.info(`Poll ${pollId} ended in guild ${poll.guildId}`);

      return { success: true };

    } catch (error) {
      this.logger.error('Error ending poll:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Handle button interactions for poll voting
   */
  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      if (!interaction.guild) return;

      // Parse custom ID: format is "poll:vote:pollId:optionId"
      const [prefix, action, pollIdStr, optionIdStr] = interaction.customId.split(':');
      
      if (prefix !== 'poll' || action !== 'vote') {
        return;
      }

      const pollId = parseInt(pollIdStr);
      const optionId = parseInt(optionIdStr);

      if (isNaN(pollId) || isNaN(optionId)) {
        await interaction.reply({ content: 'Invalid poll or option ID.', ephemeral: true });
        return;
      }

      await this.handleVote(interaction, pollId, optionId);

    } catch (error) {
      this.logger.error('Error handling poll button interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing your vote.', 
          ephemeral: true 
        });
      }
    }
  }

  /**
   * Handle poll vote
   */
  async handleVote(interaction: ButtonInteraction, pollId: number, optionId: number): Promise<void> {
    try {
      if (!interaction.guild) return;

      const poll = await this.db.poll.findUnique({
        where: { id: pollId },
        include: { options: true, votes: true }
      });

      if (!poll || !poll.active) {
        await interaction.reply({ content: 'This poll is no longer active.', ephemeral: true });
        return;
      }

      if (poll.endTime && poll.endTime < new Date()) {
        await this.endPoll(pollId);
        await interaction.reply({ content: 'This poll has expired.', ephemeral: true });
        return;
      }

      // FIXED: Added proper type annotation for option parameter
      const option = poll.options.find((opt: any) => opt.id === optionId);
      if (!option) {
        await interaction.reply({ content: 'Invalid poll option.', ephemeral: true });
        return;
      }

      // FIXED: Added proper type annotation for vote parameter
      const existingVotes = poll.votes.filter((vote: any) => vote.userId === interaction.user.id);

      if (!poll.multiple && existingVotes.length > 0) {
        // Single choice poll - remove existing vote and add new one
        await this.db.pollVote.deleteMany({
          where: {
            pollId: pollId,
            userId: interaction.user.id
          }
        });
      } else if (poll.multiple) {
        // FIXED: Added proper type annotation for vote parameter
        const existingVoteForOption = existingVotes.find((vote: any) => vote.optionId === optionId);
        if (existingVoteForOption) {
          // Remove vote for this option
          await this.db.pollVote.delete({
            where: { id: existingVoteForOption.id }
          });
          
          await interaction.reply({ 
            content: `${Config.EMOJIS.SUCCESS} Your vote for "${option.text}" has been removed.`, 
            ephemeral: true 
          });
          
          // Update poll message
          const updatedPoll = await this.db.poll.findUnique({
            where: { id: pollId },
            include: { options: true, votes: true }
          });
          if (updatedPoll) {
            await this.updatePollMessage(updatedPoll as PollData);

            // Emit to dashboard
            this.client.wsManager.emitRealtimeEvent(interaction.guild.id, 'poll:voted', {
              id: pollId,
              userId: interaction.user.id,
              optionId,
              action: 'removed'
            });
          }
          return;
        }
      }

      // Add new vote
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

      // Update poll message
      const updatedPoll = await this.db.poll.findUnique({
        where: { id: pollId },
        include: { options: true, votes: true }
      });
      
      if (updatedPoll) {
        await this.updatePollMessage(updatedPoll as PollData);

        // Emit to dashboard
        this.client.wsManager.emitRealtimeEvent(interaction.guild.id, 'poll:voted', {
          id: pollId,
          userId: interaction.user.id,
          optionId,
          action: 'added'
        });
      }

    } catch (error) {
      this.logger.error('Error handling poll vote:', error);
      
      // Safe error handling - check if already replied
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing your vote.', 
          ephemeral: true 
        });
      }
    }
  }

  /**
   * Get poll data by ID
   */
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

  /**
   * Get active polls for a guild
   */
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

  /**
   * Get poll participants
   */
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

  /**
   * Create poll embed
   */
  private createPollEmbed(poll: PollData): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${Config.EMOJIS.POLL} ${poll.title}`)
      .setColor(Config.COLORS.POLL)
      .setTimestamp();

    if (poll.description) {
      embed.setDescription(poll.description);
    }

    // Calculate vote counts
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

    // Add options with vote counts
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

    // Add footer with info
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

  /**
   * Create poll components (buttons)
   */
  private createPollComponents(poll: PollData): ActionRowBuilder<ButtonBuilder>[] {
    if (!poll.active) {
      return [];
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    let buttonCount = 0;

    // Sort options by orderIndex for consistent display
    const sortedOptions = poll.options.sort((a, b) => a.orderIndex - b.orderIndex);

    for (const option of sortedOptions) {
      // Updated custom ID format to match button handler
      const button = new ButtonBuilder()
        .setCustomId(`poll:vote:${poll.id}:${option.id}`)
        .setLabel(option.text)
        .setStyle(ButtonStyle.Primary);

      if (option.emoji) {
        button.setEmoji(option.emoji);
      }

      currentRow.addComponents(button);
      buttonCount++;

      // Discord allows max 5 buttons per row
      if (buttonCount === 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
        buttonCount = 0;
      }
    }

    // Add the last row if it has buttons
    if (buttonCount > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  /**
   * Create progress bar for vote visualization
   */
  private createProgressBar(percentage: number, length = 10): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Update poll message
   */
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
      const components = this.createPollComponents(poll);

      await message.edit({ embeds: [embed], components });

    } catch (error) {
      this.logger.error('Error updating poll message:', error);
    }
  }

  /**
   * Set expiration timer for poll
   */
  private setExpirationTimer(pollId: number, endTime: Date): void {
    const delay = endTime.getTime() - Date.now();
    
    if (delay <= 0) {
      // Already expired, process immediately
      this.endPoll(pollId);
      return;
    }

    const timer = setTimeout(() => {
      this.endPoll(pollId);
    }, delay);

    this.activeTimers.set(pollId, timer);
  }

  /**
   * Start timer to check for expired polls
   */
  private startExpirationTimer(): void {
    setInterval(async () => {
      try {
        const expiredPolls = await this.db.poll.findMany({
          where: {
            active: true,
            endTime: {
              lte: new Date()
            }
          }
        });

        for (const poll of expiredPolls) {
          await this.endPoll(poll.id);
        }
      } catch (error) {
        this.logger.error('Error checking expired polls:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Initialize poll system for guild
   */
  async initializeGuild(guild: Guild): Promise<void> {
    try {
      // Load active polls and set timers
      const activePolls = await this.db.poll.findMany({
        where: {
          guildId: guild.id,
          active: true,
          endTime: {
            not: null
          }
        }
      });

      for (const poll of activePolls) {
        if (poll.endTime) {
          this.setExpirationTimer(poll.id, poll.endTime);
        }
      }

      this.logger.info(`Initialized poll system for guild ${guild.name} with ${activePolls.length} active polls`);

    } catch (error) {
      this.logger.error('Error initializing poll system for guild:', error);
    }
  }

  /**
   * Clean up old polls
   */
  async cleanup(): Promise<void> {
    try {
      // Clear all active timers
      for (const [pollId, timer] of this.activeTimers) {
        clearTimeout(timer);
      }
      this.activeTimers.clear();

      // Clean up old inactive polls (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      await this.db.poll.deleteMany({
        where: {
          active: false,
          updatedAt: {
            lt: thirtyDaysAgo
          }
        }
      });

      this.logger.info('Poll system cleanup completed');

    } catch (error) {
      this.logger.error('Error during poll cleanup:', error);
    }
  }
}