// dashboard/lib/database.ts - Fixed Database Service
import { PrismaClient, Guild, User, Poll, Giveaway, Ticket, LevelReward, Prisma, Warn, Quarantine, AutomodRule, UserLevel, PollOption, PollVote, GiveawayEntry, CustomCommand } from '@prisma/client';
import { EventEmitter } from 'events';
import { discordService } from './discordService';
import { GuildSettings, GuildWithFullStats } from '../types';

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
  autoModRules: AutomodRule[];
}

class DatabaseService extends EventEmitter {
  constructor() {
    super();
  }

  // ===== GUILD METHODS =====

  async getGuild(guildId: string): Promise<Guild | null> {
    try {
      return await prisma.guild.findUnique({ where: { id: guildId } });
    } catch (error) {
      console.error('Error getting guild:', error);
      return null;
    }
  }

  async getGuildWithFullData(guildId: string): Promise<FullGuildData | null> {
    try {
      return await prisma.guild.findUnique({
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
      }) as FullGuildData | null;
    } catch (error) {
      console.error('Error getting guild with full data:', error);
      return null;
    }
  }

  async getGuildWithFullStats(guildId: string): Promise<GuildWithFullStats | null> {
    try {
      const [guildData, discordGuildData] = await Promise.all([
        this.getGuildWithFullData(guildId),
        discordService.getGuildInfo(guildId)
      ]);

      if (!guildData) return null;

      const memberCount = discordGuildData?.memberCount ?? guildData.members?.length ?? 0;
      const onlineCount = discordGuildData?.onlineCount ?? 0;

      // Calculate comprehensive stats
      const stats = {
        memberCount,
        onlineCount,
        ticketCount: guildData.tickets?.length ?? 0,
        pollCount: guildData.polls?.length ?? 0,
        giveawayCount: guildData.giveaways?.length ?? 0,
        warningCount: guildData.warnings?.length ?? 0,
        totalUsers: guildData.members?.length ?? 0,
        activeQuarantine: await prisma.quarantine.count({ where: { guildId, active: true } }),
        totalTrackers: 0, // Placeholder for Geizhals
        activePolls: guildData.polls?.filter(p => p.active).length ?? 0,
        activeGiveaways: guildData.giveaways?.filter(g => g.active && !g.ended).length ?? 0,
        openTickets: guildData.tickets?.filter(t => t.status !== 'CLOSED').length ?? 0,
        customCommands: await prisma.customCommand.count({ where: { guildId, enabled: true } }),
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
        settings: guildData.settings as GuildSettings,
        stats,
        discord: discordGuildData || { 
          id: guildId, 
          name: guildData.name, 
          icon: null, 
          features: [], 
          memberCount, 
          onlineCount 
        },
      } as GuildWithFullStats;
    } catch (error) {
      console.error('Error getting guild with full stats:', error);
      return null;
    }
  }

  async createGuild(guildId: string, name: string): Promise<Guild> {
    try {
      const defaultSettings: GuildSettings = {
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

      return await prisma.guild.create({
        data: {
          id: guildId,
          name: name,
          settings: defaultSettings as unknown as Prisma.JsonObject,
        },
      });
    } catch (error) {
      console.error('Error creating guild:', error);
      throw error;
    }
  }

  async syncGuild(guildId: string, name: string): Promise<Guild> {
    try {
      const defaultSettings: GuildSettings = {
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

      return await prisma.guild.upsert({
        where: { id: guildId },
        update: { name },
        create: {
          id: guildId,
          name: name,
          settings: defaultSettings as unknown as Prisma.JsonObject,
        },
      });
    } catch (error) {
      console.error('Error syncing guild:', error);
      throw error;
    }
  }

  // ===== SETTINGS METHODS =====

  async getGuildSettings(guildId: string): Promise<GuildSettings | null> {
    try {
      const guild = await this.getGuild(guildId);
      return guild?.settings as GuildSettings | null;
    } catch (error) {
      console.error('Error getting guild settings:', error);
      return null;
    }
  }

  async updateGuildSettings(guildId: string, settingsUpdate: Partial<GuildSettings>): Promise<Guild> {
    try {
      const currentGuild = await this.getGuild(guildId);
      if (!currentGuild) {
        throw new Error("Guild not found");
      }

      const currentSettings = (currentGuild.settings as GuildSettings) || {};
      const updatedSettings = { ...currentSettings, ...settingsUpdate };

      const result = await prisma.guild.update({
        where: { id: guildId },
        data: { settings: updatedSettings as unknown as Prisma.JsonObject },
      });

      this.emit('guild:updated', result);
      return result;
    } catch (error) {
      console.error('Error updating guild settings:', error);
      throw error;
    }
  }

  // ===== MODERATION DATA =====

  async getModerationData(guildId: string): Promise<{ warnings: Warn[]; quarantinedUsers: Quarantine[]; autoModRules: AutoModRule[] }> {
    try {
      const [warnings, quarantinedUsers, autoModRules] = await Promise.all([
        prisma.warn.findMany({ 
          where: { guildId }, 
          orderBy: { createdAt: 'desc' }, 
          take: 20 
        }),
        prisma.quarantine.findMany({ 
          where: { guildId, active: true }, 
          orderBy: { quarantinedAt: 'desc' } 
        }),
        prisma.automodRule.findMany({ where: { guildId } })
      ]);

      return { warnings, quarantinedUsers, autoModRules };
    } catch (error) {
      console.error('Error getting moderation data:', error);
      throw error;
    }
  }

  // ===== LEVELING DATA =====

  async getLevelData(guildId: string, page: number = 1, limit: number = 25): Promise<{
    leaderboard: (UserLevel & { user: Pick<User, 'id' | 'username'>; rank: number })[];
    total: number;
    currentPage: number;
    totalPages: number;
    levelRewards: LevelReward[];
  }> {
    try {
      const skip = (page - 1) * limit;
      
      const [userLevels, totalUsers, levelRewards] = await Promise.all([
        prisma.userLevel.findMany({
          where: { guildId },
          orderBy: { xp: 'desc' },
          take: limit,
          skip: skip,
          include: { user: { select: { id: true, username: true } } }
        }),
        prisma.userLevel.count({ where: { guildId } }),
        prisma.levelReward.findMany({ 
          where: { guildId }, 
          orderBy: { level: 'asc' } 
        })
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
    } catch (error) {
      console.error('Error getting level data:', error);
      throw error;
    }
  }

  async addLevelReward(data: {
    guildId: string;
    level: number;
    roleId: string;
    description: string;
  }): Promise<LevelReward> {
    try {
      return await prisma.levelReward.create({ data });
    } catch (error) {
      console.error('Error adding level reward:', error);
      throw error;
    }
  }

  async deleteLevelReward(rewardId: number): Promise<LevelReward> {
    try {
      return await prisma.levelReward.delete({ where: { id: rewardId } });
    } catch (error) {
      console.error('Error deleting level reward:', error);
      throw error;
    }
  }

  // ===== AUTOMOD ACTIONS =====

  async toggleAutomodRule(ruleId: number, enabled: boolean): Promise<AutomodRule> {
    try {
      return await prisma.automodRule.update({ 
        where: { id: ruleId }, 
        data: { enabled } 
      });
    } catch (error) {
      console.error('Error toggling automod rule:', error);
      throw error;
    }
  }

  async deleteAutomodRule(ruleId: number): Promise<AutomodRule> {
    try {
      return await prisma.automodRule.delete({ where: { id: ruleId } });
    } catch (error) {
      console.error('Error deleting automod rule:', error);
      throw error;
    }
  }

  // ===== QUARANTINE ACTIONS =====

  async deleteQuarantineEntry(entryId: number): Promise<Quarantine> {
    try {
      return await prisma.quarantine.delete({ where: { id: entryId } });
    } catch (error) {
      console.error('Error deleting quarantine entry:', error);
      throw error;
    }
  }

  // ===== WARNING ACTIONS =====

  async deleteWarn(warningId: number): Promise<Warn> {
    try {
      return await prisma.warn.delete({ where: { id: warningId } });
    } catch (error) {
      console.error('Error deleting warning:', error);
      throw error;
    }
  }

  // ===== CLEANUP =====

  async cleanup(): Promise<void> {
    try {
      await prisma.$disconnect();
      console.log('Database cleanup completed');
    } catch (error) {
      console.error('Error during database cleanup:', error);
    }
  }
}

const databaseEvents = new DatabaseService();
export { prisma as PrismaInstance };
export default databaseEvents;