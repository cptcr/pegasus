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

  // Get all guilds with stats
  static async getAllGuildsWithStats() {
    const guilds = await prisma.guild.findMany({
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
      },
      orderBy: { name: 'asc' }
    });

    return guilds.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild._count.userLevels, // Approximation
      stats: {
        totalUsers: guild._count.userLevels,
        totalWarns: guild._count.warns,
        activeQuarantine: guild._count.quarantineEntries,
        totalTrackers: guild._count.geizhalsTrackers,
        activePolls: guild._count.polls,
        activeGiveaways: guild._count.giveaways,
        openTickets: guild._count.tickets,
        customCommands: guild._count.customCommands,
        levelingEnabled: guild.enableLeveling,
        moderationEnabled: guild.enableModeration,
        geizhalsEnabled: guild.enableGeizhals,
        enablePolls: guild.enablePolls,
        enableGiveaways: guild.enableGiveaways,
        enableTickets: guild.enableTickets
      }
    }));
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
      memberCount: guild._count.userLevels, // Will be updated with Discord API data
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

  // Moderation data
  static async getModerationData(guildId: string) {
    const [warnings, quarantineEntries, automodRules] = await Promise.all([
      prisma.warn.findMany({
        where: { guildId, active: true },
        include: {
          user: true,
          moderator: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.quarantineEntry.findMany({
        where: { guildId, active: true },
        include: {
          moderator: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
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

  // Level data with pagination
  static async getLevelData(guildId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [leaderboard, total, levelRewards] = await Promise.all([
      prisma.userLevel.findMany({
        where: { guildId },
        include: {
          user: true
        },
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

  // Utility methods
  static calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100));
  }

  static calculateXPForLevel(level: number): number {
    return level * level * 100;
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