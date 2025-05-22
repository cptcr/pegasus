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