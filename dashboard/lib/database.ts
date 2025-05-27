// dashboard/lib/database.ts - Fixed GuildSettings Issues
import { PrismaClient, Guild, User, Poll, Giveaway, Ticket, LevelReward, Prisma, Warn, Quarantine, AutoModRule, UserLevel } from '@prisma/client';
import { EventEmitter } from 'events';
import { discordService } from './discordService';
import { GuildSettings, GuildWithFullStats, FullGuildData } from '@/types/index';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

class DatabaseService extends EventEmitter {
  constructor() {
    super();
  }

  // --- Guild Methods ---

  async getGuild(guildId: string): Promise<Guild | null> {
    return prisma.guild.findUnique({ where: { id: guildId } });
  }

  async getGuildWithFullData(guildId: string): Promise<FullGuildData | null> {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        userLevels: { include: { user: true } },
        warnings: { include: { user: true } },
        polls: { include: { options: true, votes: true } },
        giveaways: { include: { entries: true } },
        tickets: true,
        logs: true,
        levelRewards: true,
        autoModRules: true,
      },
    });

    if (!guild) return null;

    // Extract unique users from various relations
    const userMap = new Map<string, User & { warnings: Warn[]; userLevels: UserLevel[] }>();
    
    // Add users from userLevels
    guild.userLevels.forEach((ul: UserLevel & { user: User }) => {
      if (ul.user && !userMap.has(ul.user.id)) {
        userMap.set(ul.user.id, {
          ...ul.user,
          warnings: [],
          userLevels: []
        });
      }
    });

    // Add users from warnings
    guild.warnings.forEach((w: Warn & { user: User }) => {
      if (w.user && !userMap.has(w.user.id)) {
        userMap.set(w.user.id, {
          ...w.user,
          warnings: [],
          userLevels: []
        });
      }
    });

    // Populate user warnings and levels
    guild.userLevels.forEach((ul: UserLevel) => {
      const user = userMap.get(ul.userId);
      if (user) {
        user.userLevels.push(ul);
      }
    });

    guild.warnings.forEach((w: Warn) => {
      const user = userMap.get(w.userId);
      if (user) {
        user.warnings.push(w);
      }
    });

    // Transform the result to match FullGuildData interface
    return {
      id: guild.id,
      name: guild.name,
      prefix: guild.prefix,
      settings: guild.settings || {},
      enableLeveling: guild.enableLeveling,
      enableModeration: guild.enableModeration,
      enableGeizhals: guild.enableGeizhals,
      enablePolls: guild.enablePolls,
      enableGiveaways: guild.enableGiveaways,
      enableAutomod: guild.enableAutomod,
      enableTickets: guild.enableTickets,
      enableMusic: guild.enableMusic,
      enableJoinToCreate: guild.enableJoinToCreate,
      createdAt: guild.createdAt,
      updatedAt: guild.updatedAt,
      ownerId: undefined, // This would come from Discord API
      description: null,  // This would come from Discord API
      members: Array.from(userMap.values()),
      warnings: guild.warnings || [],
      polls: guild.polls || [],
      giveaways: guild.giveaways || [],
      tickets: guild.tickets || [],
      logs: guild.logs || [],
      levelRewards: guild.levelRewards || [],
      autoModRules: guild.autoModRules || [],
    } as FullGuildData;
  }

  async getGuildWithFullStats(guildId: string): Promise<GuildWithFullStats | null> {
    const [guildData, discordGuildData]: [FullGuildData | null, unknown] = await Promise.all([
      this.getGuildWithFullData(guildId),
      discordService.getGuildInfo(guildId)
    ]);

    if (!guildData) return null;

    const discordData = discordGuildData as { memberCount?: number; onlineCount?: number } | null;
    const memberCount: number = discordData?.memberCount ?? guildData.members?.length ?? 0;
    const onlineCount: number = discordData?.onlineCount ?? 0;

    const stats: GuildWithFullStats['stats'] = {
      memberCount,
      onlineCount,
      ticketCount: guildData.tickets?.length ?? 0,
      pollCount: guildData.polls?.length ?? 0,
      giveawayCount: guildData.giveaways?.length ?? 0,
      warningCount: guildData.warnings?.length ?? 0,
      totalUsers: guildData.members?.length ?? 0,
      activeQuarantine: (await prisma.quarantine.count({ where: { guildId, active: true }})),
      totalTrackers: 0,
      activePolls: guildData.polls?.filter((p: Poll) => p.active).length ?? 0,
      activeGiveaways: guildData.giveaways?.filter((g: Giveaway) => g.active && !g.ended).length ?? 0,
      openTickets: guildData.tickets?.filter((t: Ticket) => t.status !== 'CLOSED').length ?? 0,
      customCommands: 0, // Would need to be implemented
      levelRewards: guildData.levelRewards?.length ?? 0,
      automodRules: guildData.autoModRules?.filter((r: AutoModRule) => r.enabled).length ?? 0,
      levelingEnabled: guildData.enableLeveling ?? true,
      moderationEnabled: guildData.enableModeration ?? true,
      geizhalsEnabled: guildData.enableGeizhals ?? false,
      enableAutomod: guildData.enableAutomod ?? false,
      enableMusic: guildData.enableMusic ?? false,
      enableJoinToCreate: guildData.enableJoinToCreate ?? false,
      engagementRate: memberCount > 0 ? Math.round(((guildData.members?.length ?? 0) / memberCount) * 100) : 0,
      moderationRate: (guildData.members?.length ?? 0) > 0 ? Math.round(((guildData.warnings?.length ?? 0) / (guildData.members?.length ?? 1)) * 100) : 0,
      lastUpdated: new Date().toISOString(),
    };

    return {
      id: guildData.id,
      name: guildData.name,
      prefix: guildData.prefix,
      settings: guildData.settings,
      enableLeveling: guildData.enableLeveling,
      enableModeration: guildData.enableModeration,
      enableGeizhals: guildData.enableGeizhals,
      enablePolls: guildData.enablePolls,
      enableGiveaways: guildData.enableGiveaways,
      enableAutomod: guildData.enableAutomod,
      enableTickets: guildData.enableTickets,
      enableMusic: guildData.enableMusic,
      enableJoinToCreate: guildData.enableJoinToCreate,
      createdAt: guildData.createdAt,
      updatedAt: guildData.updatedAt,
      stats,
      discord: discordData || { 
        id: guildId, 
        name: guildData.name, 
        icon: null, 
        features: [], 
        memberCount, 
        onlineCount 
      },
      members: guildData.members,
      warnings: guildData.warnings,
      polls: guildData.polls,
      giveaways: guildData.giveaways,
      tickets: guildData.tickets,
      logs: guildData.logs,
      levelRewards: guildData.levelRewards,
      autoModRules: guildData.autoModRules,
      userLevels: guildData.members?.map((m: { userLevels: any; }) => m.userLevels).flat()
    } as GuildWithFullStats;
  }

  async createGuildWithDefaults(guildId: string, name: string): Promise<Guild> {
    const defaultSettings: GuildSettings = {
      modLogChannelId: null, // Fixed: was modLogChannel
      quarantineRoleId: null,
      prefix: '!',
      enableLeveling: true,
      enableModeration: true,
      enablePolls: true,
      enableGiveaways: true,
      enableTickets: false,
      enableGeizhals: false,
      enableAutomod: false,
      enableMusic: false,
      enableJoinToCreate: false,
    };
    return prisma.guild.create({
      data: {
        id: guildId,
        name: name,
        settings: defaultSettings as unknown as Prisma.JsonObject,
      },
    });
  }

  async syncGuild(guildId: string, name: string): Promise<Guild> {
     const defaultSettings: GuildSettings = {
      modLogChannelId: null, // Fixed: was modLogChannel
      quarantineRoleId: null,
      prefix: '!',
      enableLeveling: true,
      enableModeration: true,
      enablePolls: true,
      enableGiveaways: true,
      enableTickets: false,
      enableGeizhals: false,
      enableAutomod: false,
      enableMusic: false,
      enableJoinToCreate: false,
    };
    return prisma.guild.upsert({
      where: { id: guildId },
      update: { name },
      create: {
        id: guildId,
        name: name,
        settings: defaultSettings as unknown as Prisma.JsonObject,
      },
    });
  }

  // --- Settings Methods ---

  async getGuildSettings(guildId: string): Promise<GuildSettings | null> {
    const guild = await this.getGuild(guildId);
    if (!guild?.settings) return null;
    
    // Safe conversion from JsonValue to GuildSettings
    return guild.settings as unknown as GuildSettings;
  }

  async updateGuildSettings(guildId: string, settingsUpdate: Partial<GuildSettings>): Promise<Guild> {
    const currentGuild = await this.getGuild(guildId);
    if (!currentGuild) {
      throw new Error("Guild not found");
    }
    
    const currentSettings = (currentGuild.settings as GuildSettings | null) || {};
    const updatedSettings = { ...currentSettings, ...settingsUpdate };

    const result = await prisma.guild.update({
      where: { id: guildId },
      data: { settings: updatedSettings as unknown as Prisma.JsonObject },
    });
    this.emit('guild:updated', result);
    return result;
  }

  // --- Moderation Data ---
  async getModerationData(guildId: string): Promise<{ warnings: Warn[]; quarantinedUsers: Quarantine[]; autoModRules: AutoModRule[] }> {
    const warnings: Warn[] = await prisma.warn.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 20 });
    const quarantinedUsers: Quarantine[] = await prisma.quarantine.findMany({ where: { guildId, active: true }, orderBy: { quarantinedAt: 'desc' } });
    const autoModRules: AutoModRule[] = await prisma.autoModRule.findMany({ where: { guildId } });
    return { warnings, quarantinedUsers, autoModRules };
  }

  // --- Leveling Data ---
  async getLevelData(guildId: string, page: number = 1, limit: number = 25): Promise<{ leaderboard: (UserLevel & { rank: number; user: { id: string; username: string } })[]; total: number; currentPage: number; totalPages: number; levelRewards: LevelReward[]}> {
    const skip: number = (page - 1) * limit;
    const [userLevels, totalUsers, levelRewards]: [
      (UserLevel & { user: { id: string; username: string } })[],
      number,
      LevelReward[]
    ] = await Promise.all([
        prisma.userLevel.findMany({
            where: { guildId },
            orderBy: { xp: 'desc' },
            take: limit,
            skip: skip,
            include: { user: { select: { id: true, username: true }} }
        }),
        prisma.userLevel.count({ where: { guildId }}),
        prisma.levelReward.findMany({ where: { guildId }, orderBy: { level: 'asc' } })
    ]);

    const rankedLeaderboard: (UserLevel & { rank: number; user: { id: string; username: string } })[] = userLevels.map((ul, index: number) => ({
        ...ul,
        rank: skip + index + 1,
    }));

    return {
        leaderboard: rankedLeaderboard,
        total: totalUsers,
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        levelRewards
    };
  }

  async addLevelReward(data: {guildId: string, level: number, roleId: string, description: string}): Promise<LevelReward> {
    return prisma.levelReward.create({data});
  }

  async deleteLevelReward(rewardId: number): Promise<LevelReward | null> {
    return prisma.levelReward.delete({ where: { id: rewardId }});
  }

  async toggleAutomodRule(ruleId: number, enabled: boolean): Promise<AutoModRule | null> {
      return prisma.autoModRule.update({ where: { id: ruleId }, data: { enabled } });
  }
  async deleteAutomodRule(ruleId: number): Promise<AutoModRule | null > {
      return prisma.autoModRule.delete({ where: { id: ruleId } });
  }

  async deleteQuarantineEntry(entryId: number): Promise<Quarantine | null> {
      return prisma.quarantine.delete({ where: { id: entryId } });
  }

  async deleteWarn(warningId: number): Promise<Warn | null> {
      return prisma.warn.delete({ where: {id: warningId } });
  }

  async createGuild(guildId: string, name: string): Promise<Guild> {
    this.emit('guild:created', { guildId, name });
    return this.createGuildWithDefaults(guildId, name);
  }
}

const databaseEvents = new DatabaseService();
export { prisma as PrismaInstance };
export default databaseEvents;