import { PrismaClient, UserLevel, QuarantineType, AutomodRuleType } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export class DatabaseService {
  static prisma = prisma;

  // Initialisierung
  static async initialize() {
    await prisma.$connect();
    console.log('✅ Datenbank verbunden');
  }

  static async disconnect() {
    await prisma.$disconnect();
    console.log('🔌 Datenbank getrennt');
  }

  // Guild Settings
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
      data,
    });
  }

  static async getGuildStats(guildId: string) {
    const [
      totalUsers,
      totalWarns, 
      activeQuarantine,
      totalTrackers,
      activePolls,
      activeGiveaways,
      openTickets,
      customCommands
    ] = await Promise.all([
      prisma.userLevel.count({ where: { guildId } }),
      prisma.warn.count({ where: { guildId, active: true } }),
      prisma.quarantineEntry.count({ where: { guildId, active: true } }),
      prisma.geizhalsTracker.count({ where: { guildId } }),
      prisma.poll.count({ where: { guildId, active: true } }),
      prisma.giveaway.count({ where: { guildId, active: true, ended: false } }),
      prisma.ticket.count({ where: { guildId, status: { not: 'CLOSED' } } }),
      prisma.customCommand.count({ where: { guildId, enabled: true } })
    ]);

    return {
      totalUsers,
      totalWarns,
      activeQuarantine,
      totalTrackers,
      activePolls,
      activeGiveaways,
      openTickets,
      customCommands
    };
  }

  // User Management
  static async getOrCreateUser(userId: string, username: string) {
    return await prisma.user.upsert({
      where: { id: userId },
      update: { username },
      create: {
        id: userId,
        username,
      },
    });
  }

  // Warn System
  static async addWarn(data: {
    userId: string;
    guildId: string;
    moderatorId: string;
    reason: string;
  }) {
    return await prisma.warn.create({
      data,
      include: {
        user: true,
        moderator: true,
      },
    });
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

  static async removeWarn(warnId: number) {
    return await prisma.warn.update({
      where: { id: warnId },
      data: { active: false },
    });
  }

  static async clearWarns(userId: string, guildId: string) {
    return await prisma.warn.updateMany({
      where: {
        userId,
        guildId,
        active: true,
      },
      data: { active: false },
    });
  }

  // Level System
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
      },
      include: {
        user: true,
      },
    });

    return { userLevel: updated, leveledUp, oldLevel: userLevel.level };
  }

  static async addMessage(userId: string, guildId: string) {
    return await prisma.userLevel.update({
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
      },
    });
  }

  static async addVoiceTime(userId: string, guildId: string, seconds: number) {
    return await prisma.userLevel.update({
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
      },
    });
  }

  static calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100));
  }

  static calculateXPForLevel(level: number): number {
    return level * level * 100;
  }

  // Leaderboard
  static async getLeaderboard(guildId: string, limit: number = 10) {
    return await prisma.userLevel.findMany({
      where: { guildId },
      include: { user: true },
      orderBy: [
        { level: 'desc' },
        { xp: 'desc' },
      ],
      take: limit,
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
    return await prisma.quarantineEntry.create({
      data,
      include: {
        moderator: true,
      },
    });
  }

  static async removeQuarantineEntry(id: number) {
    return await prisma.quarantineEntry.update({
      where: { id },
      data: { active: false },
    });
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

  // Geizhals Tracker
  static async addGeizhalsTracker(data: {
    guildId: string;
    productId: string;
    productName: string;
    targetPrice: number;
    currentPrice: number;
    category: string;
    userId: string;
  }) {
    return await prisma.geizhalsTracker.create({ data });
  }

  static async updateGeizhalsTracker(id: number, data: any) {
    return await prisma.geizhalsTracker.update({
      where: { id },
      data,
    });
  }

  static async removeGeizhalsTracker(id: number) {
    return await prisma.geizhalsTracker.delete({
      where: { id },
    });
  }

  // Poll System
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

    // Create poll options
    const pollOptions = await Promise.all(
      options.map((text, index) => 
        prisma.pollOption.create({
          data: {
            pollId: poll.id,
            text,
            emoji: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][index],
            orderIndex: index,
          },
        })
      )
    );

    return { ...poll, options: pollOptions };
  }

  static async updatePoll(pollId: number, data: any) {
    return await prisma.poll.update({
      where: { id: pollId },
      data,
    });
  }

  static async getPoll(pollId: number, guildId: string) {
    return await prisma.poll.findFirst({
      where: { id: pollId, guildId },
      include: { options: true },
    });
  }

  static async endPoll(pollId: number) {
    return await prisma.poll.update({
      where: { id: pollId },
      data: { active: false },
    });
  }

  static async getActivePolls(guildId: string) {
    return await prisma.poll.findMany({
      where: { guildId, active: true },
      include: { options: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async votePoll(pollId: number, optionId: number, userId: string) {
    return await prisma.pollVote.create({
      data: {
        pollId,
        optionId,
        userId,
      },
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

  // Giveaway System
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
    return await prisma.giveaway.create({ data });
  }

  static async updateGiveaway(giveawayId: number, data: any) {
    return await prisma.giveaway.update({
      where: { id: giveawayId },
      data,
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
      data: { ended: true, active: false },
    });
  }

  static async getActiveGiveaways(guildId: string) {
    return await prisma.giveaway.findMany({
      where: { guildId, active: true, ended: false },
      orderBy: { endTime: 'asc' },
    });
  }

  static async enterGiveaway(giveawayId: number, userId: string) {
    return await prisma.giveawayEntry.create({
      data: {
        giveawayId,
        userId,
      },
    });
  }

  static async getGiveawayParticipants(giveawayId: number) {
    return await prisma.giveawayEntry.count({
      where: { giveawayId },
    });
  }

  static async drawGiveawayWinners(giveawayId: number) {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayId },
      include: { entries: true },
    });

    if (!giveaway || giveaway.entries.length === 0) {
      return [];
    }

    const shuffled = giveaway.entries.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, giveaway.winners);
  }

  static async rerollGiveaway(giveawayId: number, newWinners: number) {
    // Get existing winners
    // This would need to be implemented based on how you track winners
    // For now, just return new random winners
    return await this.drawGiveawayWinners(giveawayId);
  }

  // Automod System
  static async createAutomodRule(data: {
    guildId: string;
    name: string;
    type: string;
    trigger: any;
    action: any;
  }) {
    return await prisma.automodRule.create({ 
      data: {
        ...data,
        type: data.type as AutomodRuleType,
        exemptRoles: [],
        exemptChannels: []
      } 
    });
  }

  static async getAutomodRules(guildId: string) {
    return await prisma.automodRule.findMany({
      where: { guildId },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async updateAutomodRule(ruleId: number, data: any) {
    return await prisma.automodRule.update({
      where: { id: ruleId },
      data,
    });
  }

  static async deleteAutomodRule(ruleId: number) {
    return await prisma.automodRule.delete({
      where: { id: ruleId },
    });
  }

  // Ticket System
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

  static async createTicket(data: {
    guildId: string;
    channelId: string;
    userId: string;
    categoryId?: number;
    category: string;
    subject: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }) {
    return await prisma.ticket.create({
      data,
      include: {
        user: true,
        ticketCategory: true,
      },
    });
  }

  static async updateTicket(ticketId: number, data: any) {
    return await prisma.ticket.update({
      where: { id: ticketId },
      data,
    });
  }

  static async closeTicket(ticketId: number, moderatorId: string) {
    return await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'CLOSED',
        moderatorId,
        closedAt: new Date(),
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

  static async getUserTempChannels(ownerId: string, guildId: string) {
    return await prisma.tempVoiceChannel.findMany({
      where: { ownerId, guildId },
    });
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
      data,
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

  // Monthly Leaderboard Management
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

  // Bulk operations for performance
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
        },
      })
    );
    
    return await Promise.all(promises);
  }

  // Cleanup operations
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
        },
      });
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
        },
      });
    }

    return expiredGiveaways;
  }

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

  // Advanced queries for dashboard
  static async getGuildAnalytics(guildId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      newMembers,
      totalMessages,
      totalWarns,
      activeTickets,
      completedTickets,
      popularCommands,
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
        where: { guildId },
        orderBy: { uses: 'desc' },
        take: 5,
      }),
    ]);

    return {
      newMembers,
      totalMessages: totalMessages._sum.messages || 0,
      totalWarns,
      activeTickets,
      completedTickets,
      popularCommands,
    };
  }

  // Search functions
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
}