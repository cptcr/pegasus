// dashboard/lib/database.ts
import { PrismaClient, Guild, User, Poll, Giveaway, Ticket, LevelReward, Prisma, Warn, Quarantine, AutoModRule, UserLevel, PollOption, PollVote, GiveawayEntry } from '@prisma/client';
import { EventEmitter } from 'events';
import { discordService } from './discordService';
import { GuildSettings, GuildWithFullStats } from '@/types/index';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export interface FullGuildData extends Guild {
  members: (User & { warnings: Warn[]; userLevels: UserLevel[] })[];
  warnings: Warn[];
  polls: (Poll & { options: PollOption[]; votes: PollVote[] })[];
  giveaways: (Giveaway & { entries: GiveawayEntry[] })[];
  tickets: Ticket[];
  logs: Prisma.JsonValue[];
  levelRewards: LevelReward[];
  autoModRules: AutoModRule[];
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
    return prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        members: { include: { warnings: true, userLevels: true } },
        warnings: true,
        polls: { include: { options: true, votes: true } },
        giveaways: { include: { entries: true } },
        tickets: true,
        logs: true,
        levelRewards: true,
        autoModRules: true,
      },
    }) as Promise<FullGuildData | null>;
  }

  async getGuildWithFullStats(guildId: string): Promise<GuildWithFullStats | null> {
    const [guildData, discordGuildData] = await Promise.all([
      this.getGuildWithFullData(guildId),
      discordService.getGuildInfo(guildId)
    ]);

    if (!guildData) return null;

    const memberCount = discordGuildData?.memberCount ?? guildData.members?.length ?? 0;
    const onlineCount = discordGuildData?.onlineCount ?? 0;

    const stats = {
      memberCount,
      onlineCount,
      ticketCount: guildData.tickets?.length ?? 0,
      pollCount: guildData.polls?.length ?? 0,
      giveawayCount: guildData.giveaways?.length ?? 0,
      warningCount: guildData.warnings?.length ?? 0,
      totalUsers: guildData.members?.length ?? 0,
      activeQuarantine: (await prisma.quarantine.count({ where: { guildId, active: true }})),
      totalTrackers: 0,
      activePolls: guildData.polls?.filter(p => p.active).length ?? 0,
      activeGiveaways: guildData.giveaways?.filter(g => g.active && !g.ended).length ?? 0,
      openTickets: guildData.tickets?.filter(t => t.status !== 'CLOSED').length ?? 0,
      customCommands: (await prisma.customCommand.count({ where: { guildId, enabled: true }})),
      levelRewards: guildData.levelRewards?.length ?? 0,
      automodRules: guildData.autoModRules?.filter(r => r.enabled).length ?? 0,
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
      ...guildData,
      stats,
      discord: discordGuildData || { id: guildId, name: guildData.name, icon: null, features: [], memberCount, onlineCount },
    } as unknown as GuildWithFullStats;
  }

  async createGuildWithDefaults(guildId: string, name: string): Promise<Guild> {
    const defaultSettings: GuildSettings = {
      logChannel: null,
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
      logChannel: null,
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
    return guild?.settings as GuildSettings | null;
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
    const warnings = await prisma.warn.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 20 });
    const quarantinedUsers = await prisma.quarantine.findMany({ where: { guildId, active: true }, orderBy: { quarantinedAt: 'desc' } });
    const autoModRules = await prisma.autoModRule.findMany({ where: { guildId } });
    return { warnings, quarantinedUsers, autoModRules };
  }

  // --- Leveling Data ---
  async getLevelData(guildId: string, page: number = 1, limit: number = 25): Promise<{ leaderboard: UserLevel[], total: number, currentPage: number, totalPages: number, levelRewards: LevelReward[]}> {
    const skip = (page - 1) * limit;
    const [userLevels, totalUsers, levelRewards] = await Promise.all([
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

    const rankedLeaderboard = userLevels.map((ul, index) => ({
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