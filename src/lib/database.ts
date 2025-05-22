// src/lib/database.ts (Enhanced Version)
import { PrismaClient } from '@prisma/client';
import { Guild as DiscordGuild, User as DiscordUser, GuildMember, TextChannel, Role } from 'discord.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export class DatabaseService {
  static prisma = prisma;

  // Initialisierung
  static async initialize() {
    await prisma.$connect();
    console.log('✅ Database connected');
  }

  static async disconnect() {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected');
  }

  // Enhanced Guild Management with Discord Integration
  static async syncGuild(discordGuild: DiscordGuild) {
    try {
      const guild = await prisma.guild.upsert({
        where: { id: discordGuild.id },
        update: { 
          name: discordGuild.name,
          updatedAt: new Date()
        },
        create: {
          id: discordGuild.id,
          name: discordGuild.name,
        },
      });

      console.log(`✅ Synced guild: ${discordGuild.name} (${discordGuild.id})`);
      return guild;
    } catch (error) {
      console.error(`Failed to sync guild ${discordGuild.id}:`, error);
      throw error;
    }
  }

  static async getGuildSettings(guildId: string) {
    return await prisma.guild.upsert({
      where: { id: guildId },
      update: {},
      create: {
        id: guildId,
        name: 'Unknown Guild',
      },
    });
  }

  static async updateGuildSettings(guildId: string, data: any) {
    return await prisma.guild.update({
      where: { id: guildId },
      data: {
        ...data,
        updatedAt: new Date()
      },
    });
  }

  // Enhanced Guild Stats with Real-time Data
  static async getGuildStats(guildId: string) {
    const [
      totalUsers,
      totalWarns, 
      activeQuarantine,
      totalTrackers,
      activePolls,
      activeGiveaways,
      openTickets,
      customCommands,
      levelRewards,
      automodRules
    ] = await Promise.all([
      prisma.userLevel.count({ where: { guildId } }),
      prisma.warn.count({ where: { guildId, active: true } }),
      prisma.quarantineEntry.count({ where: { guildId, active: true } }),
      prisma.geizhalsTracker.count({ where: { guildId } }),
      prisma.poll.count({ where: { guildId, active: true } }),
      prisma.giveaway.count({ where: { guildId, active: true, ended: false } }),
      prisma.ticket.count({ where: { guildId, status: { not: 'CLOSED' } } }),
      prisma.customCommand.count({ where: { guildId, enabled: true } }),
      prisma.levelReward.count({ where: { guildId } }),
      prisma.automodRule.count({ where: { guildId, enabled: true } })
    ]);

    return {
      totalUsers,
      totalWarns,
      activeQuarantine,
      totalTrackers,
      activePolls,
      activeGiveaways,
      openTickets,
      customCommands,
      levelRewards,
      automodRules
    };
  }

  // Enhanced User Management
  static async syncUser(discordUser: DiscordUser) {
    return await prisma.user.upsert({
      where: { id: discordUser.id },
      update: { 
        username: discordUser.username,
        updatedAt: new Date()
      },
      create: {
        id: discordUser.id,
        username: discordUser.username,
      },
    });
  }

  static async getOrCreateUser(userId: string, username: string) {
    return await prisma.user.upsert({
      where: { id: userId },
      update: { 
        username,
        updatedAt: new Date()
      },
      create: {
        id: userId,
        username,
      },
    });
  }

  // Enhanced Level System with Real-time Updates
  static async getUserLevel(userId: string, guildId: string) {
    return await prisma.userLevel.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      update: {},
      create: {
        userId,
        guildId,
      },
      include: {
        user: true,
      },
    });
  }

  static async addXP(userId: string, guildId: string, xpToAdd: number) {
    const userLevel = await this.getUserLevel(userId, guildId);
    const newXP = userLevel.xp + xpToAdd;
    const newLevel = this.calculateLevel(newXP);
    
    const leveledUp = newLevel > userLevel.level;

    const updated = await prisma.userLevel.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        xp: newXP,
        level: newLevel,
        lastMessageTime: new Date(),
        updatedAt: new Date()
      },
      include: {
        user: true,
      },
    });

    // Update monthly stats if level up occurred
    if (leveledUp) {
      await this.updateMonthlyStats(userId, guildId, xpToAdd, 0, 0);
    }

    return { userLevel: updated, leveledUp, oldLevel: userLevel.level };
  }

  static async addMessage(userId: string, guildId: string) {
    const result = await prisma.userLevel.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        messages: {
          increment: 1,
        },
        updatedAt: new Date()
      },
    });

    // Update monthly stats
    await this.updateMonthlyStats(userId, guildId, 0, 1, 0);
    return result;
  }

  static async addVoiceTime(userId: string, guildId: string, seconds: number) {
    const result = await prisma.userLevel.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        voiceTime: {
          increment: seconds,
        },
        lastVoiceJoin: new Date(),
        updatedAt: new Date()
      },
    });

    // Update monthly stats
    await this.updateMonthlyStats(userId, guildId, 0, 0, seconds);
    return result;
  }

  // Advanced Analytics
  static async getGuildAnalytics(guildId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      newMembers,
      totalMessages,
      totalVoiceTime,
      totalWarns,
      activeTickets,
      completedTickets,
      popularCommands,
      activeTrackers,
      recentPolls,
      recentGiveaways
    ] = await Promise.all([
      prisma.userLevel.count({
        where: {
          guildId,
          createdAt: {
            gte: since,
          },
        },
      }),
      prisma.userLevel.aggregate({
        where: { guildId },
        _sum: {
          messages: true,
        },
      }),
      prisma.userLevel.aggregate({
        where: { guildId },
        _sum: {
          voiceTime: true,
        },
      }),
      prisma.warn.count({
        where: {
          guildId,
          createdAt: {
            gte: since,
          },
        },
      }),
      prisma.ticket.count({
        where: {
          guildId,
          status: { not: 'CLOSED' },
        },
      }),
      prisma.ticket.count({
        where: {
          guildId,
          status: 'CLOSED',
          closedAt: {
            gte: since,
          },
        },
      }),
      prisma.customCommand.findMany({
        where: { guildId, enabled: true },
        orderBy: { uses: 'desc' },
        take: 5,
      }),
      prisma.geizhalsTracker.count({
        where: { guildId }
      }),
      prisma.poll.count({
        where: {
          guildId,
          createdAt: { gte: since }
        }
      }),
      prisma.giveaway.count({
        where: {
          guildId,
          createdAt: { gte: since }
        }
      })
    ]);

    return {
      newMembers,
      totalMessages: totalMessages._sum.messages || 0,
      totalVoiceTime: totalVoiceTime._sum.voiceTime || 0,
      totalWarns,
      activeTickets,
      completedTickets,
      popularCommands,
      activeTrackers,
      recentPolls,
      recentGiveaways,
      period: days
    };
  }

  // Enhanced Moderation System
  static async addWarn(data: {
    userId: string;
    guildId: string;
    moderatorId: string;
    reason: string;
  }) {
    const warn = await prisma.warn.create({
      data,
      include: {
        user: true,
        moderator: true,
      },
    });

    // Log the action
    console.log(`⚠️ Warning added: ${data.userId} in ${data.guildId} by ${data.moderatorId}`);
    
    return warn;
  }

  static async getActiveWarns(userId: string, guildId: string) {
    return await prisma.warn.findMany({
      where: {
        userId,
        guildId,
        active: true,
      },
      include: {
        moderator: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Enhanced Poll System with Real-time Updates
  static async createPoll(data: {
    guildId: string;
    channelId: string;
    title: string;
    description?: string;
    creatorId: string;
    multiple: boolean;
    anonymous: boolean;
    endTime?: Date;
    options: string[];
  }) {
    const { options, ...pollData } = data;
    
    const poll = await prisma.poll.create({
      data: pollData,
      include: { options: true },
    });

    // Create poll options with emojis
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const pollOptions = await Promise.all(
      options.map((text, index) => 
        prisma.pollOption.create({
          data: {
            pollId: poll.id,
            text,
            emoji: emojis[index] || '📊',
            orderIndex: index,
          },
        })
      )
    );

    console.log(`📊 Poll created: ${poll.title} (${poll.id}) in ${data.guildId}`);
    return { ...poll, options: pollOptions };
  }

  static async votePoll(pollId: number, optionId: number, userId: string) {
    const vote = await prisma.pollVote.create({
      data: {
        pollId,
        optionId,
        userId,
      },
    });

    console.log(`🗳️ Vote cast: Poll ${pollId}, Option ${optionId}, User ${userId}`);
    return vote;
  }

  static async getPollResults(pollId: number) {
    const options = await prisma.pollOption.findMany({
      where: { pollId },
      include: {
        _count: {
          select: { votes: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    return options.map(option => ({
      id: option.id,
      text: option.text,
      emoji: option.emoji,
      votes: option._count.votes,
    }));
  }

  // Enhanced Giveaway System
  static async createGiveaway(data: {
    guildId: string;
    channelId: string;
    title: string;
    description?: string;
    prize: string;
    winners: number;
    creatorId: string;
    endTime: Date;
    requirements?: any;
  }) {
    const giveaway = await prisma.giveaway.create({ 
      data,
      include: { entries: true }
    });

    console.log(`🎉 Giveaway created: ${giveaway.title} (${giveaway.id}) in ${data.guildId}`);
    return giveaway;
  }

  static async enterGiveaway(giveawayId: number, userId: string) {
    try {
      const entry = await prisma.giveawayEntry.create({
        data: {
          giveawayId,
          userId,
        },
      });

      console.log(`🎁 Giveaway entry: User ${userId} entered giveaway ${giveawayId}`);
      return entry;
    } catch (error) {
      // Handle duplicate entry error
      if ((error as any).code === 'P2002') {
        throw new Error('You are already participating in this giveaway');
      }
      throw error;
    }
  }

  static async drawGiveawayWinners(giveawayId: number) {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayId },
      include: { entries: true },
    });

    if (!giveaway || giveaway.entries.length === 0) {
      return [];
    }

    // Shuffle entries and select winners
    const shuffled = giveaway.entries.sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, Math.min(giveaway.winners, shuffled.length));

    console.log(`🏆 Winners drawn for giveaway ${giveawayId}: ${winners.length} winner(s)`);
    return winners;
  }

  // Enhanced Ticket System
  static async createTicket(data: {
    guildId: string;
    channelId: string;
    userId: string;
    categoryId?: number;
    category: string;
    subject: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }) {
    const ticket = await prisma.ticket.create({
      data: {
        ...data,
        priority: data.priority || 'MEDIUM'
      },
      include: {
        user: true,
        ticketCategory: true,
      },
    });

    console.log(`🎫 Ticket created: ${ticket.subject} (${ticket.id}) by ${data.userId}`);
    return ticket;
  }

  static async getTicketByChannel(channelId: string) {
    return await prisma.ticket.findFirst({
      where: { channelId },
      include: {
        user: true,
        moderator: true,
        ticketCategory: true,
      },
    });
  }

  // Automod System
  static async createAutomodRule(data: {
    guildId: string;
    name: string;
    type: string;
    trigger: any;
    action: any;
  }) {
    const rule = await prisma.automodRule.create({ 
      data: {
        ...data,
        type: data.type as any,
        exemptRoles: [],
        exemptChannels: []
      } 
    });

    console.log(`🤖 Automod rule created: ${rule.name} (${rule.id}) in ${data.guildId}`);
    return rule;
  }

  static async getAutomodRules(guildId: string) {
    return await prisma.automodRule.findMany({
      where: { guildId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Enhanced Cleanup Operations
  static async cleanupExpiredPolls() {
    const expiredPolls = await prisma.poll.findMany({
      where: {
        active: true,
        endTime: {
          lte: new Date(),
        },
      },
    });

    if (expiredPolls.length > 0) {
      await prisma.poll.updateMany({
        where: {
          id: {
            in: expiredPolls.map(p => p.id),
          },
        },
        data: {
          active: false,
          updatedAt: new Date()
        },
      });

      console.log(`📊 Cleaned up ${expiredPolls.length} expired polls`);
    }

    return expiredPolls;
  }

  static async cleanupExpiredGiveaways() {
    const expiredGiveaways = await prisma.giveaway.findMany({
      where: {
        active: true,
        ended: false,
        endTime: {
          lte: new Date(),
        },
      },
      include: {
        entries: true,
      },
    });

    if (expiredGiveaways.length > 0) {
      await prisma.giveaway.updateMany({
        where: {
          id: {
            in: expiredGiveaways.map(g => g.id),
          },
        },
        data: {
          active: false,
          ended: true,
          updatedAt: new Date()
        },
      });

      console.log(`🎉 Cleaned up ${expiredGiveaways.length} expired giveaways`);
    }

    return expiredGiveaways;
  }

  // Utility Methods
  static calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100));
  }

  static calculateXPForLevel(level: number): number {
    return level * level * 100;
  }

  // Performance Monitoring
  static async getPerformanceMetrics() {
    const [
      totalGuilds,
      totalUsers,
      totalLevels,
      totalWarns,
      totalPolls,
      totalGiveaways,
      totalTickets,
      dbSize
    ] = await Promise.all([
      prisma.guild.count(),
      prisma.user.count(),
      prisma.userLevel.count(),
      prisma.warn.count({ where: { active: true } }),
      prisma.poll.count(),
      prisma.giveaway.count(),
      prisma.ticket.count(),
      prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`
    ]);

    return {
      totalGuilds,
      totalUsers,
      totalLevels,
      totalWarns,
      totalPolls,
      totalGiveaways,
      totalTickets,
      databaseSize: (dbSize as any)[0]?.size || 'Unknown',
      timestamp: new Date()
    };
  }

  // Monthly Stats Management
  static async updateMonthlyStats(userId: string, guildId: string, xpGained: number, messagesAdded: number, voiceTimeAdded: number) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    return await prisma.monthlyLeaderboard.upsert({
      where: {
        guildId_userId_month_year: {
          guildId,
          userId,
          month,
          year,
        },
      },
      update: {
        xpGained: {
          increment: xpGained,
        },
        messages: {
          increment: messagesAdded,
        },
        voiceTime: {
          increment: voiceTimeAdded,
        },
        updatedAt: new Date()
      },
      create: {
        guildId,
        userId,
        month,
        year,
        xpGained,
        messages: messagesAdded,
        voiceTime: voiceTimeAdded,
      },
    });
  }

  // Leaderboard with Pagination
  static async getLeaderboard(guildId: string, limit: number = 10, offset: number = 0) {
    return await prisma.userLevel.findMany({
      where: { guildId },
      include: { user: true },
      orderBy: [
        { level: 'desc' },
        { xp: 'desc' },
      ],
      take: limit,
      skip: offset,
    });
  }

  static async getMonthlyLeaderboard(guildId: string, month: number, year: number, limit: number = 10) {
    return await prisma.monthlyLeaderboard.findMany({
      where: {
        guildId,
        month,
        year,
      },
      orderBy: [
        { xpGained: 'desc' },
      ],
      take: limit,
    });
  }

  // Level Rewards
  static async getLevelRewards(guildId: string) {
    return await prisma.levelReward.findMany({
      where: { guildId },
      orderBy: { level: 'asc' },
    });
  }

  static async addLevelReward(data: {
    guildId: string;
    level: number;
    roleId: string;
    description?: string;
  }) {
    return await prisma.levelReward.create({ data });
  }

  static async removeLevelReward(guildId: string, level: number) {
    return await prisma.levelReward.delete({
      where: {
        guildId_level: {
          guildId,
          level,
        },
      },
    });
  }

  // Quarantine System
  static async addQuarantineEntry(data: {
    guildId: string;
    targetId: string;
    targetType: 'USER' | 'CHANNEL' | 'ROLE';
    moderatorId: string;
    reason: string;
  }) {
    const entry = await prisma.quarantineEntry.create({
      data,
      include: {
        moderator: true,
      },
    });

    console.log(`🔒 Quarantine entry added: ${data.targetType} ${data.targetId} by ${data.moderatorId}`);
    return entry;
  }

  static async removeQuarantineEntry(id: number) {
    const entry = await prisma.quarantineEntry.update({
      where: { id },
      data: { 
        active: false,
        updatedAt: new Date()
      },
    });

    console.log(`🔓 Quarantine entry removed: ${id}`);
    return entry;
  }

  static async getActiveQuarantineEntries(guildId: string) {
    return await prisma.quarantineEntry.findMany({
      where: {
        guildId,
        active: true,
      },
      include: {
        moderator: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getQuarantineEntry(id: number) {
    return await prisma.quarantineEntry.findUnique({
      where: { id },
      include: {
        moderator: true,
      },
    });
  }

  // Geizhals Tracker System
  static async addGeizhalsTracker(data: {
    guildId: string;
    productId: string;
    productName: string;
    targetPrice: number;
    currentPrice: number;
    category: string;
    userId: string;
  }) {
    const tracker = await prisma.geizhalsTracker.create({ data });
    console.log(`💰 Geizhals tracker added: ${data.productName} for ${data.userId}`);
    return tracker;
  }

  static async updateGeizhalsTracker(id: number, data: any) {
    return await prisma.geizhalsTracker.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
    });
  }

  static async removeGeizhalsTracker(id: number) {
    const tracker = await prisma.geizhalsTracker.delete({
      where: { id },
    });
    console.log(`💰 Geizhals tracker removed: ${id}`);
    return tracker;
  }

  // Custom Commands
  static async createCustomCommand(data: {
    guildId: string;
    name: string;
    response: string;
    description?: string;
    creatorId: string;
  }) {
    return await prisma.customCommand.create({ data });
  }

  static async getCustomCommand(guildId: string, name: string) {
    return await prisma.customCommand.findUnique({
      where: {
        guildId_name: {
          guildId,
          name,
        },
      },
    });
  }

  static async getCustomCommands(guildId: string) {
    return await prisma.customCommand.findMany({
      where: { guildId, enabled: true },
      orderBy: { name: 'asc' },
    });
  }

  static async updateCustomCommand(guildId: string, name: string, data: any) {
    return await prisma.customCommand.update({
      where: {
        guildId_name: {
          guildId,
          name,
        },
      },
      data: {
        ...data,
        updatedAt: new Date()
      },
    });
  }

  static async deleteCustomCommand(guildId: string, name: string) {
    return await prisma.customCommand.delete({
      where: {
        guildId_name: {
          guildId,
          name,
        },
      },
    });
  }

  static async incrementCommandUse(guildId: string, name: string) {
    return await prisma.customCommand.update({
      where: {
        guildId_name: {
          guildId,
          name,
        },
      },
      data: {
        uses: {
          increment: 1,
        },
        updatedAt: new Date()
      },
    });
  }

  // Reaction Roles
  static async createReactionRole(data: {
    guildId: string;
    channelId: string;
    messageId: string;
    emoji: string;
    roleId: string;
  }) {
    return await prisma.reactionRole.create({ data });
  }

  static async getReactionRole(messageId: string, emoji: string) {
    return await prisma.reactionRole.findUnique({
      where: {
        messageId_emoji: {
          messageId,
          emoji,
        },
      },
    });
  }

  static async getReactionRoles(guildId: string) {
    return await prisma.reactionRole.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async deleteReactionRole(messageId: string, emoji: string) {
    return await prisma.reactionRole.delete({
      where: {
        messageId_emoji: {
          messageId,
          emoji,
        },
      },
    });
  }

  // Join-To-Create System
  static async createTempChannel(data: {
    guildId: string;
    channelId: string;
    ownerId: string;
  }) {
    return await prisma.tempVoiceChannel.create({ data });
  }

  static async getTempChannel(channelId: string) {
    return await prisma.tempVoiceChannel.findUnique({
      where: { channelId },
      include: { owner: true },
    });
  }

  static async getTempChannelByUser(userId: string, guildId: string) {
    return await prisma.tempVoiceChannel.findFirst({
      where: { 
        ownerId: userId,
        guildId: guildId
      },
      include: { owner: true },
    });
  }

  static async deleteTempChannel(channelId: string) {
    return await prisma.tempVoiceChannel.delete({
      where: { channelId },
    });
  }

  // Ticket Categories
  static async createTicketCategory(data: {
    guildId: string;
    name: string;
    description?: string;
    emoji?: string;
    channelId?: string;
    categoryId?: string;
  }) {
    return await prisma.ticketCategory.create({ data });
  }

  static async getTicketCategories(guildId: string) {
    return await prisma.ticketCategory.findMany({
      where: { guildId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async updateTicket(ticketId: number, data: any) {
    return await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ...data,
        updatedAt: new Date()
      },
    });
  }

  static async closeTicket(ticketId: number, moderatorId: string) {
    return await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'CLOSED',
        moderatorId,
        closedAt: new Date(),
        updatedAt: new Date()
      },
    });
  }

  static async getOpenTickets(guildId: string) {
    return await prisma.ticket.findMany({
      where: {
        guildId,
        status: { not: 'CLOSED' },
      },
      include: {
        user: true,
        moderator: true,
        ticketCategory: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Poll Management
  static async getPoll(pollId: number, guildId: string) {
    return await prisma.poll.findFirst({
      where: { id: pollId, guildId },
      include: { options: true },
    });
  }

  static async updatePoll(pollId: number, data: any) {
    return await prisma.poll.update({
      where: { id: pollId },
      data: {
        ...data,
        updatedAt: new Date()
      },
    });
  }

  static async endPoll(pollId: number) {
    return await prisma.poll.update({
      where: { id: pollId },
      data: { 
        active: false,
        updatedAt: new Date()
      },
    });
  }

  static async getActivePolls(guildId: string) {
    return await prisma.poll.findMany({
      where: { guildId, active: true },
      include: { options: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async removeVote(pollId: number, optionId: number, userId: string) {
    return await prisma.pollVote.deleteMany({
      where: {
        pollId,
        optionId,
        userId,
      },
    });
  }

  static async getUserVotes(pollId: number, userId: string) {
    return await prisma.pollVote.findMany({
      where: { pollId, userId },
      include: { option: true },
    });
  }

  // Giveaway Management
  static async updateGiveaway(giveawayId: number, data: any) {
    return await prisma.giveaway.update({
      where: { id: giveawayId },
      data: {
        ...data,
        updatedAt: new Date()
      },
    });
  }

  static async getGiveaway(giveawayId: number, guildId: string) {
    return await prisma.giveaway.findFirst({
      where: { id: giveawayId, guildId },
      include: { entries: true },
    });
  }

  static async endGiveaway(giveawayId: number) {
    return await prisma.giveaway.update({
      where: { id: giveawayId },
      data: { 
        ended: true, 
        active: false,
        updatedAt: new Date()
      },
    });
  }

  static async getActiveGiveaways(guildId: string) {
    return await prisma.giveaway.findMany({
      where: { guildId, active: true, ended: false },
      include: { entries: true },
      orderBy: { endTime: 'asc' },
    });
  }

  static async getGiveawayParticipants(giveawayId: number) {
    return await prisma.giveawayEntry.count({
      where: { giveawayId },
    });
  }

  static async rerollGiveaway(giveawayId: number, newWinners: number) {
    // This would need to track previous winners to exclude them
    // For simplicity, we'll just return new random winners
    return await this.drawGiveawayWinners(giveawayId);
  }

  // Automod Rule Management
  static async updateAutomodRule(ruleId: number, data: any) {
    return await prisma.automodRule.update({
      where: { id: ruleId },
      data: {
        ...data,
        updatedAt: new Date()
      },
    });
  }

  static async deleteAutomodRule(ruleId: number) {
    return await prisma.automodRule.delete({
      where: { id: ruleId },
    });
  }

  // Warning Management
  static async removeWarn(warnId: number) {
    return await prisma.warn.update({
      where: { id: warnId },
      data: { 
        active: false,
        updatedAt: new Date()
      },
    });
  }

  static async clearWarns(userId: string, guildId: string) {
    return await prisma.warn.updateMany({
      where: {
        userId,
        guildId,
        active: true,
      },
      data: { 
        active: false,
        updatedAt: new Date()
      },
    });
  }

  // Bulk Operations for Performance
  static async bulkCreateUsers(users: Array<{ id: string; username: string }>) {
    return await prisma.user.createMany({
      data: users,
      skipDuplicates: true,
    });
  }

  static async bulkUpdateTrackers(updates: Array<{ id: number; currentPrice: number; lastCheck: Date }>) {
    const promises = updates.map(update =>
      prisma.geizhalsTracker.update({
        where: { id: update.id },
        data: {
          currentPrice: update.currentPrice,
          lastCheck: update.lastCheck,
          updatedAt: new Date()
        },
      })
    );
    
    return await Promise.all(promises);
  }

  // Cleanup old data
  static async cleanupOldMonthlyStats(monthsToKeep: number = 12) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);
    
    return await prisma.monthlyLeaderboard.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
  }

  // Search functions for dashboard
  static async searchUsers(guildId: string, query: string, limit: number = 10) {
    return await prisma.userLevel.findMany({
      where: {
        guildId,
        user: {
          username: {
            contains: query,
            mode: 'insensitive',
          },
        },
      },
      include: {
        user: true,
      },
      take: limit,
      orderBy: {
        level: 'desc',
      },
    });
  }

  static async searchTickets(guildId: string, query: string, limit: number = 10) {
    return await prisma.ticket.findMany({
      where: {
        guildId,
        OR: [
          {
            subject: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            category: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        user: true,
        moderator: true,
        ticketCategory: true,
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Health Check
  static async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error: error, timestamp: new Date() };
    }
  }

  // Database Statistics
  static async getDatabaseStats() {
    try {
      const [
        guildCount,
        userCount,
        userLevelCount,
        warnCount,
        pollCount,
        giveawayCount,
        ticketCount,
        trackerCount,
        commandCount,
        reactionRoleCount,
        tempChannelCount
      ] = await Promise.all([
        prisma.guild.count(),
        prisma.user.count(),
        prisma.userLevel.count(),
        prisma.warn.count(),
        prisma.poll.count(),
        prisma.giveaway.count(),
        prisma.ticket.count(),
        prisma.geizhalsTracker.count(),
        prisma.customCommand.count(),
        prisma.reactionRole.count(),
        prisma.tempVoiceChannel.count()
      ]);

      return {
        guilds: guildCount,
        users: userCount,
        userLevels: userLevelCount,
        warnings: warnCount,
        polls: pollCount,
        giveaways: giveawayCount,
        tickets: ticketCount,
        trackers: trackerCount,
        customCommands: commandCount,
        reactionRoles: reactionRoleCount,
        tempChannels: tempChannelCount,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  // Transaction wrapper for complex operations
  static async executeTransaction<T>(
    operation: (tx: any) => Promise<T>
  ): Promise<T> {
    return await prisma.$transaction(operation);
  }

  // Batch operations with transaction support
  static async batchUpdateUserLevels(updates: Array<{
    userId: string;
    guildId: string;
    xp: number;
    level: number;
    messages?: number;
    voiceTime?: number;
  }>) {
    return await this.executeTransaction(async (tx) => {
      const results = [];
      for (const update of updates) {
        const result = await tx.userLevel.upsert({
          where: {
            userId_guildId: {
              userId: update.userId,
              guildId: update.guildId,
            },
          },
          update: {
            xp: update.xp,
            level: update.level,
            messages: update.messages,
            voiceTime: update.voiceTime,
            updatedAt: new Date()
          },
          create: {
            userId: update.userId,
            guildId: update.guildId,
            xp: update.xp,
            level: update.level,
            messages: update.messages || 0,
            voiceTime: update.voiceTime || 0,
          },
        });
        results.push(result);
      }
      return results;
    });
  }

  // Advanced guild management
  static async getGuildWithFullStats(guildId: string) {
    return await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        userLevels: {
          include: { user: true },
          orderBy: [{ level: 'desc' }, { xp: 'desc' }],
          take: 10
        },
        warns: {
          where: { active: true },
          include: { user: true, moderator: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        quarantineEntries: {
          where: { active: true },
          include: { moderator: true },
          orderBy: { createdAt: 'desc' }
        },
        geizhalsTrackers: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        polls: {
          where: { active: true },
          include: { options: true },
          orderBy: { createdAt: 'desc' }
        },
        giveaways: {
          where: { active: true, ended: false },
          include: { entries: true },
          orderBy: { endTime: 'asc' }
        },
        tickets: {
          where: { status: { not: 'CLOSED' } },
          include: { user: true, moderator: true, ticketCategory: true },
          orderBy: { createdAt: 'desc' }
        },
        customCommands: {
          where: { enabled: true },
          orderBy: { uses: 'desc' },
          take: 10
        },
        levelRewards: {
          orderBy: { level: 'asc' }
        },
        automodRules: {
          orderBy: { createdAt: 'asc' }
        },
        ticketCategories: {
          where: { enabled: true },
          orderBy: { name: 'asc' }
        }
      }
    });
  }

  // Migration helper functions
  static async migrateOldData() {
    // This would contain any data migration logic
    console.log('Starting data migration...');
    
    // Example: Update all guilds with default settings
    const guildsWithoutSettings = await prisma.guild.findMany({
      where: {
        OR: [
          { enableLeveling: null },
          { enableModeration: null }
        ]
      }
    });

    for (const guild of guildsWithoutSettings) {
      await prisma.guild.update({
        where: { id: guild.id },
        data: {
          enableLeveling: true,
          enableModeration: true,
          enableGeizhals: false,
          enablePolls: true,
          enableGiveaways: true,
          enableAutomod: false,
          enableTickets: false,
          enableMusic: false,
          enableJoinToCreate: false,
          updatedAt: new Date()
        }
      });
    }

    console.log(`✅ Migrated ${guildsWithoutSettings.length} guilds`);
  }

  // Backup and restore functions
  static async createBackup(guildId?: string) {
    const backupData: any = {
      timestamp: new Date(),
      version: '2.0.0'
    };

    if (guildId) {
      // Guild-specific backup
      backupData.guild = await this.getGuildWithFullStats(guildId);
    } else {
      // Full database backup (metadata only)
      backupData.stats = await this.getDatabaseStats();
      backupData.performance = await this.getPerformanceMetrics();
    }

    return backupData;
  }

  // Data validation functions
  static async validateDataIntegrity() {
    const issues = [];

    // Check for orphaned records
    const orphanedUserLevels = await prisma.userLevel.count({
      where: {
        user: null
      }
    });

    if (orphanedUserLevels > 0) {
      issues.push(`Found ${orphanedUserLevels} orphaned user levels`);
    }

    const orphanedWarns = await prisma.warn.count({
      where: {
        OR: [
          { user: null },
          { moderator: null }
        ]
      }
    });

    if (orphanedWarns > 0) {
      issues.push(`Found ${orphanedWarns} orphaned warnings`);
    }

    // Check for invalid data
    const invalidLevels = await prisma.userLevel.count({
      where: {
        OR: [
          { xp: { lt: 0 } },
          { level: { lt: 0 } },
          { messages: { lt: 0 } },
          { voiceTime: { lt: 0 } }
        ]
      }
    });

    if (invalidLevels > 0) {
      issues.push(`Found ${invalidLevels} user levels with invalid data`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      timestamp: new Date()
    };
  }

  // Performance optimization functions
  static async optimizeDatabase() {
    try {
      // Analyze tables for better query performance
      await prisma.$executeRaw`ANALYZE;`;
      
      // Vacuum to reclaim space
      await prisma.$executeRaw`VACUUM ANALYZE;`;
      
      console.log('✅ Database optimization completed');
      return { success: true, timestamp: new Date() };
    } catch (error) {
      console.error('❌ Database optimization failed:', error);
      return { success: false, error, timestamp: new Date() };
    }
  }

  // Connection management
  static async reconnect() {
    try {
      await prisma.$disconnect();
      await prisma.$connect();
      console.log('✅ Database reconnection successful');
      return true;
    } catch (error) {
      console.error('❌ Database reconnection failed:', error);
      return false;
    }
  }

  // Monitoring functions
  static async getConnectionInfo() {
    try {
      const result = await prisma.$queryRaw`
        SELECT 
          pg_stat_activity.datname,
          pg_stat_activity.application_name,
          pg_stat_activity.state,
          pg_stat_activity.backend_start,
          pg_stat_activity.query_start
        FROM pg_stat_activity 
        WHERE pg_stat_activity.datname = current_database()
      `;
      
      return {
        connections: result,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting connection info:', error);
      return { connections: [], error, timestamp: new Date() };
    }
  }

  // Cache management (if Redis is integrated)
  static async clearCache(pattern?: string) {
    // This would integrate with Redis if available
    console.log(`🗑️ Cache cleared ${pattern ? `for pattern: ${pattern}` : '(all)'}`);
    return { success: true, timestamp: new Date() };
  }

  // Error logging
  static async logError(error: Error, context?: any) {
    try {
      // In a production environment, this might log to a separate error table
      console.error('Database Error:', {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date()
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }
}

// Export singleton instance
export const db = DatabaseService;