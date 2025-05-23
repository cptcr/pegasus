// dashboard/lib/database.ts (Enhanced with Real-time Data)
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Event emitter for real-time updates
export const databaseEvents = new EventEmitter();

export class DatabaseService {
  static prisma = prisma;
  static events = databaseEvents;

  // Real-time Guild Management
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
            customCommands: { where: { enabled: true } },
            levelRewards: true,
            automodRules: { where: { enabled: true } }
          }
        }
      }
    });

    if (!guild) {
      // Create guild if it doesn't exist
      return await this.createGuildWithDefaults(guildId);
    }

    return {
      id: guild.id,
      name: guild.name,
      memberCount: guild._count.userLevels,
      iconURL: null, // Will be filled by Discord API
      stats: {
        totalUsers: guild._count.userLevels,
        totalWarns: guild._count.warns,
        activeQuarantine: guild._count.quarantineEntries,
        totalTrackers: guild._count.geizhalsTrackers,
        activePolls: guild._count.polls,
        activeGiveaways: guild._count.giveaways,
        openTickets: guild._count.tickets,
        customCommands: guild._count.customCommands,
        levelRewards: guild._count.levelRewards,
        automodRules: guild._count.automodRules,
        levelingEnabled: guild.enableLeveling,
        moderationEnabled: guild.enableModeration,
        geizhalsEnabled: guild.enableGeizhals,
        enablePolls: guild.enablePolls,
        enableGiveaways: guild.enableGiveaways,
        enableTickets: guild.enableTickets,
        enableAutomod: guild.enableAutomod,
        enableMusic: guild.enableMusic,
        enableJoinToCreate: guild.enableJoinToCreate
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

  static async createGuildWithDefaults(guildId: string) {
    const guild = await prisma.guild.create({
      data: {
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
      }
    });

    // Emit event for real-time updates
    this.events.emit('guild:created', { guildId, guild });

    return {
      id: guild.id,
      name: guild.name,
      memberCount: 0,
      iconURL: null,
      stats: {
        totalUsers: 0,
        totalWarns: 0,
        activeQuarantine: 0,
        totalTrackers: 0,
        activePolls: 0,
        activeGiveaways: 0,
        openTickets: 0,
        customCommands: 0,
        levelRewards: 0,
        automodRules: 0,
        levelingEnabled: guild.enableLeveling,
        moderationEnabled: guild.enableModeration,
        geizhalsEnabled: guild.enableGeizhals,
        enablePolls: guild.enablePolls,
        enableGiveaways: guild.enableGiveaways,
        enableTickets: guild.enableTickets,
        enableAutomod: guild.enableAutomod,
        enableMusic: guild.enableMusic,
        enableJoinToCreate: guild.enableJoinToCreate
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
    const updated = await prisma.guild.update({
      where: { id: guildId },
      data: {
        ...data,
        updatedAt: new Date()
      },
    });

    // Emit event for real-time updates
    this.events.emit('guild:updated', { guildId, data: updated });

    return updated;
  }

  // Real-time Guild Stats
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

  // Real-time Recent Activity
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

  // Real-time Moderation Data
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

  // Real-time Level Data with Pagination
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

  // Management Operations with Real-time Events
  static async deleteWarn(warnId: number) {
    const warn = await prisma.warn.update({
      where: { id: warnId },
      data: { active: false, updatedAt: new Date() }
    });

    this.events.emit('warn:deleted', { warnId, guildId: warn.guildId });
    return warn;
  }

  static async deleteQuarantineEntry(entryId: number) {
    const entry = await prisma.quarantineEntry.update({
      where: { id: entryId },
      data: { active: false, updatedAt: new Date() }
    });

    this.events.emit('quarantine:deleted', { entryId, guildId: entry.guildId });
    return entry;
  }

  static async closePoll(pollId: number) {
    const poll = await prisma.poll.update({
      where: { id: pollId },
      data: { active: false, updatedAt: new Date() }
    });

    this.events.emit('poll:closed', { pollId, guildId: poll.guildId });
    return poll;
  }

  static async endGiveaway(giveawayId: number) {
    const giveaway = await prisma.giveaway.update({
      where: { id: giveawayId },
      data: { ended: true, active: false, updatedAt: new Date() }
    });

    this.events.emit('giveaway:ended', { giveawayId, guildId: giveaway.guildId });
    return giveaway;
  }

  static async closeTicket(ticketId: number, moderatorId: string) {
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'CLOSED',
        moderatorId,
        closedAt: new Date(),
        updatedAt: new Date()
      }
    });

    this.events.emit('ticket:closed', { ticketId, guildId: ticket.guildId });
    return ticket;
  }

  static async toggleCustomCommand(guildId: string, commandName: string, enabled: boolean) {
    const command = await prisma.customCommand.update({
      where: {
        guildId_name: { guildId, name: commandName }
      },
      data: { enabled, updatedAt: new Date() }
    });

    this.events.emit('command:toggled', { guildId, commandName, enabled });
    return command;
  }

  static async deleteCustomCommand(guildId: string, commandName: string) {
    const command = await prisma.customCommand.delete({
      where: {
        guildId_name: { guildId, name: commandName }
      }
    });

    this.events.emit('command:deleted', { guildId, commandName });
    return command;
  }

  static async deleteGeizhalsTracker(trackerId: number) {
    const tracker = await prisma.geizhalsTracker.delete({
      where: { id: trackerId }
    });

    this.events.emit('tracker:deleted', { trackerId, guildId: tracker.guildId });
    return tracker;
  }

  static async toggleAutomodRule(ruleId: number, enabled: boolean) {
    const rule = await prisma.automodRule.update({
      where: { id: ruleId },
      data: { enabled, updatedAt: new Date() }
    });

    this.events.emit('automod:toggled', { ruleId, guildId: rule.guildId, enabled });
    return rule;
  }

  static async deleteAutomodRule(ruleId: number) {
    const rule = await prisma.automodRule.delete({
      where: { id: ruleId }
    });

    this.events.emit('automod:deleted', { ruleId, guildId: rule.guildId });
    return rule;
  }

  static async addLevelReward(data: {
    guildId: string;
    level: number;
    roleId: string;
    description?: string;
  }) {
    const reward = await prisma.levelReward.create({ data });

    this.events.emit('levelReward:created', { guildId: data.guildId, reward });
    return reward;
  }

  static async deleteLevelReward(rewardId: number) {
    const reward = await prisma.levelReward.delete({
      where: { id: rewardId }
    });

    this.events.emit('levelReward:deleted', { rewardId, guildId: reward.guildId });
    return reward;
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