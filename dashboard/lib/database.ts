// dashboard/lib/database.ts - Improved with Better Error Handling and Optimizations
import { PrismaClient, Guild, User, Poll, Giveaway, Ticket, LevelReward, Prisma, Warn, Quarantine, AutoModRule, UserLevel } from '.prisma/dashboard-client';
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

/**
 * Database Service Class
 * Handles all database operations for the Discord bot dashboard
 */
class DatabaseService extends EventEmitter {
  constructor() {
    super();
  }

  // --- Guild Methods ---

  /**
   * Get basic guild information
   */
  async getGuild(guildId: string): Promise<Guild | null> {
    try {
      return await prisma.guild.findUnique({ where: { id: guildId } });
    } catch (error) {
      console.error(`[DB] Failed to fetch guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Get guild with all related data including members, warnings, etc.
   */
  async getGuildWithFullData(guildId: string): Promise<FullGuildData | null> {
    try {
      const [guild, discordGuildInfo] = await Promise.all([
        prisma.guild.findUnique({
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
        }),
        discordService.getGuildInfo(guildId)
      ]);

      if (!guild) {
        console.warn(`[DB] Guild ${guildId} not found in database`);
        return null;
      }

      // Extract unique users from various relations with proper typing
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
      const fullGuildData: FullGuildData = {
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
        // Enhanced with Discord API data
        ownerId: discordGuildInfo?.ownerId,
        description: discordGuildInfo?.description,
        members: Array.from(userMap.values()),
        warnings: guild.warnings || [],
        polls: guild.polls || [],
        giveaways: guild.giveaways || [],
        tickets: guild.tickets || [],
        logs: guild.logs || [],
        levelRewards: guild.levelRewards || [],
        autoModRules: guild.autoModRules || [],
      };

      return fullGuildData;
    } catch (error) {
      console.error(`[DB] Failed to fetch full guild data for ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Get guild with comprehensive stats for dashboard display
   */
  async getGuildWithFullStats(guildId: string): Promise<GuildWithFullStats | null> {
    try {
      const [guildData, discordGuildData] = await Promise.all([
        this.getGuildWithFullData(guildId),
        discordService.getGuildInfo(guildId)
      ]);

      if (!guildData) {
        console.warn(`[DB] Could not fetch guild data for stats calculation: ${guildId}`);
        return null;
      }

      // Cache frequently used values to avoid repeated calculations
      const memberCountFromDB = guildData.members?.length ?? 0;
      const memberCountFromDiscord = discordGuildData?.memberCount ?? memberCountFromDB;
      const onlineCount = discordGuildData?.onlineCount ?? 0;
      const warningCount = guildData.warnings?.length ?? 0;
      const activeQuarantineCount = await this.getActiveQuarantineCount(guildId);

      const stats: GuildWithFullStats['stats'] = {
        memberCount: memberCountFromDiscord,
        onlineCount,
        ticketCount: guildData.tickets?.length ?? 0,
        pollCount: guildData.polls?.length ?? 0,
        giveawayCount: guildData.giveaways?.length ?? 0,
        warningCount,
        totalUsers: memberCountFromDB,
        activeQuarantine: activeQuarantineCount,
        totalTrackers: 0, // Would need separate tracker table
        activePolls: guildData.polls?.filter((p: Poll) => p.active).length ?? 0,
        activeGiveaways: guildData.giveaways?.filter((g: Giveaway) => g.active && !g.ended).length ?? 0,
        openTickets: guildData.tickets?.filter((t: Ticket) => t.status !== 'CLOSED').length ?? 0,
        customCommands: 0, // Would need implementation
        levelRewards: guildData.levelRewards?.length ?? 0,
        automodRules: guildData.autoModRules?.filter((r: AutoModRule) => r.enabled).length ?? 0,
        levelingEnabled: guildData.enableLeveling ?? true,
        moderationEnabled: guildData.enableModeration ?? true,
        geizhalsEnabled: guildData.enableGeizhals ?? false,
        enableAutomod: guildData.enableAutomod ?? false,
        enableMusic: guildData.enableMusic ?? false,
        enableJoinToCreate: guildData.enableJoinToCreate ?? false,
        engagementRate: memberCountFromDiscord > 0 ? Math.round((memberCountFromDB / memberCountFromDiscord) * 100) : 0,
        moderationRate: memberCountFromDB > 0 ? Math.round((warningCount / memberCountFromDB) * 100) : 0,
        lastUpdated: new Date().toISOString(),
      };

      // Ensure Discord data has required fields with proper defaults
      const discordResponse = discordGuildData ? {
        id: discordGuildData.id,
        name: discordGuildData.name,
        icon: discordGuildData.iconURL,
        iconURL: discordGuildData.iconURL,
        features: discordGuildData.features || [],
        memberCount: memberCountFromDiscord,
        onlineCount,
        ownerId: discordGuildData.ownerId,
        description: discordGuildData.description,
        createdAt: discordGuildData.createdAt,
      } : {
        id: guildId,
        name: guildData.name,
        icon: null,
        iconURL: null,
        features: [],
        memberCount: memberCountFromDiscord,
        onlineCount,
        ownerId: guildData.ownerId || undefined,
        description: guildData.description,
        createdAt: guildData.createdAt,
      };

      const result: GuildWithFullStats = {
        ...guildData,
        settings: guildData.settings,
        stats,
        discord: discordResponse,
        members: guildData.members,
        warnings: guildData.warnings,
        polls: guildData.polls,
        giveaways: guildData.giveaways,
        tickets: guildData.tickets,
        logs: guildData.logs,
        levelRewards: guildData.levelRewards,
        autoModRules: guildData.autoModRules,
        userLevels: guildData.members?.map((m) => m.userLevels).flat() || []
      };

      return result;
    } catch (error) {
      console.error(`[DB] Failed to fetch guild with full stats for ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Get active quarantine count efficiently
   */
  private async getActiveQuarantineCount(guildId: string): Promise<number> {
    try {
      return await prisma.quarantine.count({ 
        where: { guildId, active: true } 
      });
    } catch (error) {
      console.error(`[DB] Failed to get active quarantine count for ${guildId}:`, error);
      return 0;
    }
  }

  /**
   * Create guild with comprehensive default settings
   */
  async createGuildWithDefaults(guildId: string, name: string): Promise<Guild | null> {
    try {
      const defaultSettings: GuildSettings = this.getDefaultGuildSettings();
      
      const guild = await prisma.guild.create({
        data: {
          id: guildId,
          name: name,
          settings: defaultSettings as unknown as Prisma.JsonObject,
        },
      });

      this.emit('guild:created', { guildId, name });
      console.log(`[DB] Created guild with defaults: ${name} (${guildId})`);
      return guild;
    } catch (error) {
      console.error(`[DB] Failed to create guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Sync guild information (upsert operation)
   */
  async syncGuild(guildId: string, name: string): Promise<Guild | null> {
    try {
      const defaultSettings: GuildSettings = this.getDefaultGuildSettings();
      
      const guild = await prisma.guild.upsert({
        where: { id: guildId },
        update: { 
          name,
          updatedAt: new Date()
        },
        create: {
          id: guildId,
          name: name,
          settings: defaultSettings as unknown as Prisma.JsonObject,
        },
      });

      console.log(`[DB] Synced guild: ${name} (${guildId})`);
      return guild;
    } catch (error) {
      console.error(`[DB] Failed to sync guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Get default guild settings with documentation
   */
  private getDefaultGuildSettings(): GuildSettings {
    return {
      /** Command prefix for the bot */
      prefix: '!',
      /** Channel ID for moderation logs */
      modLogChannelId: null,
      /** Role ID for quarantined users */
      quarantineRoleId: null,
      /** Role ID for staff members */
      staffRoleId: null,
      /** Enable the leveling/XP system */
      enableLeveling: true,
      /** Enable moderation features */
      enableModeration: true,
      /** Enable community polls */
      enablePolls: true,
      /** Enable giveaway system */
      enableGiveaways: true,
      /** Enable support ticket system */
      enableTickets: false,
      /** Enable Geizhals price tracking */
      enableGeizhals: false,
      /** Enable automatic moderation */
      enableAutomod: false,
      /** Enable music bot features */
      enableMusic: false,
      /** Enable join-to-create voice channels */
      enableJoinToCreate: false,
      /** Channel for welcome messages */
      welcomeChannelId: null,
      /** Channel for level-up notifications */
      levelUpChannelId: null,
      /** Channel for Geizhals notifications */
      geizhalsChannelId: null,
      /** Voice channel for join-to-create */
      joinToCreateChannelId: null,
      /** Category for join-to-create channels */
      joinToCreateCategoryId: null,
      /** Welcome message template */
      welcomeMessage: "Welcome {user} to {server}!",
      /** Goodbye message template */
      goodbyeMessage: "{user} has left the server.",
    };
  }

  // --- Settings Methods ---

  /**
   * Get guild settings with proper error handling
   */
  async getGuildSettings(guildId: string): Promise<GuildSettings | null> {
    try {
      const guild = await this.getGuild(guildId);
      if (!guild?.settings) {
        console.warn(`[DB] No settings found for guild ${guildId}`);
        return null;
      }
      
      // Safe conversion from JsonValue to GuildSettings
      return guild.settings as unknown as GuildSettings;
    } catch (error) {
      console.error(`[DB] Failed to get guild settings for ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Update guild settings with validation and error handling
   */
  async updateGuildSettings(guildId: string, settingsUpdate: Partial<GuildSettings>): Promise<Guild | null> {
    try {
      const currentGuild = await this.getGuild(guildId);
      if (!currentGuild) {
        throw new Error(`Guild ${guildId} not found`);
      }
      
      // Safe settings merge
      const currentSettings: GuildSettings = currentGuild.settings 
        ? currentGuild.settings as GuildSettings 
        : this.getDefaultGuildSettings();
      
      const updatedSettings = { ...currentSettings, ...settingsUpdate };

      const result = await prisma.guild.update({
        where: { id: guildId },
        data: { 
          settings: updatedSettings as unknown as Prisma.JsonObject,
          updatedAt: new Date()
        },
      });

      this.emit('guild:updated', result);
      console.log(`[DB] Updated settings for guild ${guildId}`);
      return result;
    } catch (error) {
      console.error(`[DB] Failed to update guild settings for ${guildId}:`, error);
      return null;
    }
  }

  // --- Moderation Data ---
  
  /**
   * Get comprehensive moderation data for a guild
   */
  async getModerationData(guildId: string): Promise<{ warnings: Warn[]; quarantinedUsers: Quarantine[]; autoModRules: AutoModRule[] }> {
    try {
      const [warnings, quarantinedUsers, autoModRules] = await Promise.all([
        prisma.warn.findMany({ 
          where: { guildId }, 
          orderBy: { createdAt: 'desc' }, 
          take: 50,
          include: { user: true }
        }),
        prisma.quarantine.findMany({ 
          where: { guildId, active: true }, 
          orderBy: { quarantinedAt: 'desc' },
          include: { user: true }
        }),
        prisma.autoModRule.findMany({ 
          where: { guildId },
          orderBy: { createdAt: 'desc' }
        })
      ]);

      return { warnings, quarantinedUsers, autoModRules };
    } catch (error) {
      console.error(`[DB] Failed to get moderation data for ${guildId}:`, error);
      return { warnings: [], quarantinedUsers: [], autoModRules: [] };
    }
  }

  // --- Leveling Data ---
  
  /**
   * Get paginated level data with enhanced error handling
   */
  async getLevelData(guildId: string, page: number = 1, limit: number = 25): Promise<{
    leaderboard: (UserLevel & { rank: number; user: { id: string; username: string } })[];
    total: number;
    currentPage: number;
    totalPages: number;
    levelRewards: LevelReward[];
  }> {
    try {
      const skip: number = (page - 1) * limit;
      
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

      const rankedLeaderboard = userLevels.map((ul, index: number) => ({
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
      console.error(`[DB] Failed to get level data for ${guildId}:`, error);
      return {
        leaderboard: [],
        total: 0,
        currentPage: page,
        totalPages: 0,
        levelRewards: []
      };
    }
  }

  // --- CRUD Operations with Error Handling ---

  async addLevelReward(data: {guildId: string, level: number, roleId: string, description: string}): Promise<LevelReward | null> {
    try {
      const reward = await prisma.levelReward.create({ data });
      console.log(`[DB] Added level reward for guild ${data.guildId}: Level ${data.level}`);
      return reward;
    } catch (error) {
      console.error(`[DB] Failed to add level reward:`, error);
      return null;
    }
  }

  async deleteLevelReward(rewardId: number): Promise<LevelReward | null> {
    try {
      const reward = await prisma.levelReward.delete({ where: { id: rewardId } });
      console.log(`[DB] Deleted level reward ${rewardId}`);
      return reward;
    } catch (error) {
      console.error(`[DB] Failed to delete level reward ${rewardId}:`, error);
      return null;
    }
  }

  async toggleAutomodRule(ruleId: number, enabled: boolean): Promise<AutoModRule | null> {
    try {
      const rule = await prisma.autoModRule.update({ 
        where: { id: ruleId }, 
        data: { enabled, updatedAt: new Date() } 
      });
      console.log(`[DB] Toggled automod rule ${ruleId}: ${enabled ? 'enabled' : 'disabled'}`);
      return rule;
    } catch (error) {
      console.error(`[DB] Failed to toggle automod rule ${ruleId}:`, error);
      return null;
    }
  }
  
  async deleteAutomodRule(ruleId: number): Promise<AutoModRule | null> {
    try {
      const rule = await prisma.autoModRule.delete({ where: { id: ruleId } });
      console.log(`[DB] Deleted automod rule ${ruleId}`);
      return rule;
    } catch (error) {
      console.error(`[DB] Failed to delete automod rule ${ruleId}:`, error);
      return null;
    }
  }

  async deleteQuarantineEntry(entryId: number): Promise<Quarantine | null> {
    try {
      const entry = await prisma.quarantine.delete({ where: { id: entryId } });
      console.log(`[DB] Deleted quarantine entry ${entryId}`);
      return entry;
    } catch (error) {
      console.error(`[DB] Failed to delete quarantine entry ${entryId}:`, error);
      return null;
    }
  }

  async deleteWarn(warningId: number): Promise<Warn | null> {
    try {
      const warning = await prisma.warn.delete({ where: { id: warningId } });
      console.log(`[DB] Deleted warning ${warningId}`);
      return warning;
    } catch (error) {
      console.error(`[DB] Failed to delete warning ${warningId}:`, error);
      return null;
    }
  }

  /**
   * Create guild with event emission
   */
  async createGuild(guildId: string, name: string): Promise<Guild | null> {
    try {
      const guild = await this.createGuildWithDefaults(guildId, name);
      if (guild) {
        this.emit('guild:created', { guildId, name });
      }
      return guild;
    } catch (error) {
      console.error(`[DB] Failed to create guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Health check for database service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: Record<string, unknown> }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        details: {
          database: 'connected',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          database: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

const databaseEvents = new DatabaseService();

// Export both the service and direct Prisma access
export { prisma as PrismaInstance };
export default databaseEvents;