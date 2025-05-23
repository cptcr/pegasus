// dashboard/lib/database.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export class DatabaseService {
  static prisma = prisma;

  // Guild Management
  static async getGuildSettings(guildId: string) {
    return await prisma.guild.upsert({
      where: { id: guildId },
      update: {},
      create: {
        id: guildId,
        name: 'Unknown Guild',
        prefix: '!',
        enableLeveling: true,
        enableModeration: true,
        enableGeizhals: false,
        enablePolls: true,
        enableGiveaways: true,
        enableAutomod: false,
        enableTickets: false,
        enableMusic: false,
        enableJoinToCreate: false
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

  // Guild Stats
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

  // Recent Activity
  static async getRecentActivity(guildId: string, days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [recentWarns, recentPolls, recentGiveaways, recentTickets] = await Promise.all([
      prisma.warn.count({
        where: {
          guildId,
          createdAt: { gte: since }
        }
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
      }),
      prisma.ticket.count({
        where: {
          guildId,
          createdAt: { gte: since }
        }
      })
    ]);

    return {
      recentWarns,
      recentPolls,
      recentGiveaways,
      recentTickets
    };
  }

  // Moderation Data
  static async getModerationData(guildId: string) {
    const [warnings, quarantineEntries, automodRules] = await Promise.all([
      prisma.warn.findMany({
        where: { guildId, active: true },
        include: {
          user: true,
          moderator: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.quarantineEntry.findMany({
        where: { guildId, active: true },
        include: {
          moderator: true,
          user: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.automodRule.findMany({
        where: { guildId },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    return {
      warnings,
      quarantineEntries,
      automodRules
    };
  }

  // Level System Data
  static async getLevelData(guildId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [leaderboard, total, levelRewards] = await Promise.all([
      prisma.userLevel.findMany({
        where: { guildId },
        include: { user: true },
        orderBy: [
          { level: 'desc' },
          { xp: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.userLevel.count({
        where: { guildId }
      }),
      prisma.levelReward.findMany({
        where: { guildId },
        orderBy: { level: 'asc' }
      })
    ]);

    return {
      leaderboard: leaderboard.map((entry, index) => ({
        ...entry,
        rank: skip + index + 1
      })),
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      levelRewards
    };
  }

  // Polls Data
  static async getPollsData(guildId: string) {
    const [activePolls, recentPolls] = await Promise.all([
      prisma.poll.findMany({
        where: { guildId, active: true },
        include: {
          options: {
            include: {
              _count: {
                select: { votes: true }
              }
            }
          },
          _count: {
            select: { votes: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.poll.findMany({
        where: { guildId, active: false },
        include: {
          options: {
            include: {
              _count: {
                select: { votes: true }
              }
            }
          },
          _count: {
            select: { votes: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    return { activePolls, recentPolls };
  }

  // Giveaways Data
  static async getGiveawaysData(guildId: string) {
    const [activeGiveaways, recentGiveaways] = await Promise.all([
      prisma.giveaway.findMany({
        where: { guildId, active: true, ended: false },
        include: {
          _count: {
            select: { entries: true }
          }
        },
        orderBy: { endTime: 'asc' }
      }),
      prisma.giveaway.findMany({
        where: { guildId, ended: true },
        include: {
          _count: {
            select: { entries: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    return { activeGiveaways, recentGiveaways };
  }

  // Tickets Data
  static async getTicketsData(guildId: string) {
    const [openTickets, recentTickets, ticketCategories] = await Promise.all([
      prisma.ticket.findMany({
        where: { 
          guildId, 
          status: { not: 'CLOSED' } 
        },
        include: {
          user: true,
          moderator: true,
          ticketCategory: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.ticket.findMany({
        where: { 
          guildId, 
          status: 'CLOSED' 
        },
        include: {
          user: true,
          moderator: true,
          ticketCategory: true
        },
        orderBy: { closedAt: 'desc' },
        take: 20
      }),
      prisma.ticketCategory.findMany({
        where: { guildId, enabled: true },
        orderBy: { name: 'asc' }
      })
    ]);

    return { openTickets, recentTickets, ticketCategories };
  }

  // Geizhals Trackers Data
  static async getGeizhalsData(guildId: string) {
    const trackers = await prisma.geizhalsTracker.findMany({
      where: { guildId },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });

    const stats = {
      totalTrackers: trackers.length,
      activeTrackers: trackers.filter(t => !t.notified).length,
      triggeredTrackers: trackers.filter(t => t.notified).length,
      categoriesCount: new Set(trackers.map(t => t.category)).size
    };

    return { trackers, stats };
  }

  // Custom Commands Data
  static async getCustomCommandsData(guildId: string) {
    const commands = await prisma.customCommand.findMany({
      where: { guildId },
      orderBy: [
        { enabled: 'desc' },
        { uses: 'desc' }
      ]
    });

    const stats = {
      totalCommands: commands.length,
      enabledCommands: commands.filter(c => c.enabled).length,
      totalUses: commands.reduce((sum, c) => sum + c.uses, 0)
    };

    return { commands, stats };
  }

  // Get guild with full data
  static async getGuildWithFullData(guildId: string) {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        _count: {
          select: {
            warns: { where: { active: true } },
            userLevels: true,
            quarantineEntries: { where: { active: true } },
            geizhalsTrackers: true,
            polls: { where: { active: true } },
            giveaways: { where: { active: true, ended: false } },
            tickets: { where: { status: { not: 'CLOSED' } } },
            customCommands: { where: { enabled: true } }
          }
        }
      }
    });

    if (!guild) return null;

    return {
      id: guild.id,
      name: guild.name,
      memberCount: guild._count.userLevels,
      stats: {
        totalUsers: guild._count.userLevels,
        totalWarns: guild._count.warns,
        activeQuarantine: guild._count.quarantineEntries,
        totalTrackers: guild._count.geizhalsTrackers,
        activePolls: guild._count.polls,
        activeGiveaways: guild._count.giveaways,
        openTickets: guild._count.tickets,
        customCommands: guild._count.customCommands
      },
      settings: {
        enableLeveling: guild.enableLeveling,
        enableModeration: guild.enableModeration,
        enableGeizhals: guild.enableGeizhals,
        enablePolls: guild.enablePolls,
        enableGiveaways: guild.enableGiveaways,
        enableTickets: guild.enableTickets,
        enableAutomod: guild.enableAutomod,
        enableMusic: guild.enableMusic,
        enableJoinToCreate: guild.enableJoinToCreate
      },
      config: {
        prefix: guild.prefix,
        modLogChannelId: guild.modLogChannelId,
        levelUpChannelId: guild.levelUpChannelId,
        quarantineRoleId: guild.quarantineRoleId,
        geizhalsChannelId: guild.geizhalsChannelId,
        welcomeChannelId: guild.welcomeChannelId,
        joinToCreateChannelId: guild.joinToCreateChannelId,
        joinToCreateCategoryId: guild.joinToCreateCategoryId,
        welcomeMessage: guild.welcomeMessage,
        leaveMessage: guild.leaveMessage
      }
    };
  }

  // Management Operations
  static async deleteWarn(warnId: number) {
    return await prisma.warn.update({
      where: { id: warnId },
      data: { active: false, updatedAt: new Date() }
    });
  }

  static async deleteQuarantineEntry(entryId: number) {
    return await prisma.quarantineEntry.update({
      where: { id: entryId },
      data: { active: false, updatedAt: new Date() }
    });
  }

  static async closePoll(pollId: number) {
    return await prisma.poll.update({
      where: { id: pollId },
      data: { active: false, updatedAt: new Date() }
    });
  }

  static async endGiveaway(giveawayId: number) {
    return await prisma.giveaway.update({
      where: { id: giveawayId },
      data: { ended: true, active: false, updatedAt: new Date() }
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
      }
    });
  }

  static async toggleCustomCommand(guildId: string, commandName: string, enabled: boolean) {
    return await prisma.customCommand.update({
      where: {
        guildId_name: { guildId, name: commandName }
      },
      data: { enabled, updatedAt: new Date() }
    });
  }

  static async deleteCustomCommand(guildId: string, commandName: string) {
    return await prisma.customCommand.delete({
      where: {
        guildId_name: { guildId, name: commandName }
      }
    });
  }

  static async deleteGeizhalsTracker(trackerId: number) {
    return await prisma.geizhalsTracker.delete({
      where: { id: trackerId }
    });
  }

  static async toggleAutomodRule(ruleId: number, enabled: boolean) {
    return await prisma.automodRule.update({
      where: { id: ruleId },
      data: { enabled, updatedAt: new Date() }
    });
  }

  static async deleteAutomodRule(ruleId: number) {
    return await prisma.automodRule.delete({
      where: { id: ruleId }
    });
  }

  // Analytics
  static async getAdvancedAnalytics(guildId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      userActivity,
      moderationTrends,
      featureUsage,
      topUsers
    ] = await Promise.all([
      // User activity trends
      prisma.userLevel.aggregate({
        where: { 
          guildId,
          updatedAt: { gte: since }
        },
        _sum: {
          messages: true,
          voiceTime: true,
          xp: true
        },
        _avg: {
          level: true
        }
      }),
      
      // Moderation trends
      prisma.warn.groupBy({
        by: ['createdAt'],
        where: {
          guildId,
          createdAt: { gte: since }
        },
        _count: true
      }),
      
      // Feature usage
      Promise.all([
        prisma.poll.count({ where: { guildId, createdAt: { gte: since } } }),
        prisma.giveaway.count({ where: { guildId, createdAt: { gte: since } } }),
        prisma.ticket.count({ where: { guildId, createdAt: { gte: since } } }),
        prisma.customCommand.aggregate({
          where: { guildId },
          _sum: { uses: true }
        })
      ]),
      
      // Top users by activity
      prisma.userLevel.findMany({
        where: { guildId },
        include: { user: true },
        orderBy: { xp: 'desc' },
        take: 10
      })
    ]);

    return {
      userActivity,
      moderationTrends,
      featureUsage: {
        polls: featureUsage[0],
        giveaways: featureUsage[1],
        tickets: featureUsage[2],
        commandUses: featureUsage[3]._sum.uses || 0
      },
      topUsers,
      period: days
    };
  }

  // Health check
  static async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error, timestamp: new Date() };
    }
  }

  // Connection management
  static async initialize() {
    await prisma.$connect();
    console.log('✅ Database connected');
  }

  static async disconnect() {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected');
  }
}

export const db = DatabaseService;