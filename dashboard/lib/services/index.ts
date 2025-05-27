// dashboard/lib/services/index.ts - Modular Service Architecture

import { PrismaClient } from '.prisma/dashboard-client';
import { GuildSettings } from '@/types/index';

declare global {
  var prisma: PrismaClient | undefined;
}

// Base service class with common functionality
abstract class BaseService {
  constructor(protected prisma: PrismaClient) {}

  protected async handleError<T>(
    operation: string,
    promise: Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      console.error(`[${this.constructor.name}] ${operation} failed:`, error);
      return fallback;
    }
  }

  protected logSuccess(operation: string, details?: string): void {
    console.log(`[${this.constructor.name}] ${operation}${details ? `: ${details}` : ''}`);
  }
}

// --- Settings Service ---
export class SettingsService extends BaseService {
  /**
   * Get comprehensive default guild settings
   */
  getDefaultSettings(): GuildSettings {
    return {
      // Core Configuration
      prefix: '!',
      
      // Channel Configuration
      modLogChannelId: null,
      welcomeChannelId: null,
      levelUpChannelId: null,
      geizhalsChannelId: null,
      joinToCreateChannelId: null,
      joinToCreateCategoryId: null,
      
      // Role Configuration  
      quarantineRoleId: null,
      staffRoleId: null,
      
      // Feature Toggles
      enableLeveling: true,
      enableModeration: true,
      enablePolls: true,
      enableGiveaways: true,
      enableTickets: false,
      enableGeizhals: false,
      enableAutomod: false,
      enableMusic: false,
      enableJoinToCreate: false,
      
      // Message Templates
      welcomeMessage: "Welcome {user} to {server}!",
      goodbyeMessage: "{user} has left the server.",
    };
  }

  /**
   * Get guild settings with fallback to defaults
   */
  async getGuildSettings(guildId: string): Promise<GuildSettings> {
    return this.handleError(
      `get settings for guild ${guildId}`,
      this.prisma.guild.findUnique({ where: { id: guildId } })
        .then(guild => guild?.settings as GuildSettings || this.getDefaultSettings()),
      this.getDefaultSettings()
    );
  }

  /**
   * Update guild settings with validation
   */
  async updateGuildSettings(
    guildId: string, 
    updates: Partial<GuildSettings>
  ): Promise<GuildSettings | null> {
    return this.handleError(
      `update settings for guild ${guildId}`,
      this.performSettingsUpdate(guildId, updates),
      null
    );
  }

  private async performSettingsUpdate(
    guildId: string, 
    updates: Partial<GuildSettings>
  ): Promise<GuildSettings> {
    // Get current settings
    const currentSettings = await this.getGuildSettings(guildId);
    
    // Merge with updates
    const newSettings = { ...currentSettings, ...updates };
    
    // Validate settings (add validation logic here if needed)
    this.validateSettings(newSettings);
    
    // Update in database
    const updatedGuild = await this.prisma.guild.update({
      where: { id: guildId },
      data: { 
        settings: newSettings as any,
        updatedAt: new Date()
      }
    });

    this.logSuccess(`updated settings for guild ${guildId}`);
    return updatedGuild.settings as GuildSettings;
  }

  private validateSettings(settings: GuildSettings): void {
    // Add validation logic here
    if (settings.prefix && settings.prefix.length > 5) {
      throw new Error('Prefix cannot be longer than 5 characters');
    }
    // Add more validation as needed
  }
}

// --- Leveling Service ---
export class LevelingService extends BaseService {
  /**
   * Get paginated leaderboard with comprehensive data
   */
  async getLeaderboard(guildId: string, page: number = 1, limit: number = 25) {
    return this.handleError(
      `get leaderboard for guild ${guildId} (page ${page})`,
      this.fetchLeaderboardData(guildId, page, limit),
      {
        leaderboard: [],
        total: 0,
        currentPage: page,
        totalPages: 0,
        levelRewards: []
      }
    );
  }

  private async fetchLeaderboardData(guildId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    
    const [userLevels, totalUsers, levelRewards] = await Promise.all([
      this.prisma.userLevel.findMany({
        where: { guildId },
        orderBy: { xp: 'desc' },
        take: limit,
        skip: skip,
        include: { 
          user: { 
            select: { id: true, username: true, avatar: true } 
          } 
        }
      }),
      this.prisma.userLevel.count({ where: { guildId } }),
      this.prisma.levelReward.findMany({ 
        where: { guildId }, 
        orderBy: { level: 'asc' } 
      })
    ]);

    const rankedLeaderboard = userLevels.map((ul, index) => ({
      ...ul,
      rank: skip + index + 1,
      // Calculate XP progress to next level
      xpToNextLevel: this.calculateXPForLevel(ul.level + 1) - ul.xp,
      xpProgress: this.calculateXPProgress(ul.level, ul.xp)
    }));

    return {
      leaderboard: rankedLeaderboard,
      total: totalUsers,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      levelRewards
    };
  }

  /**
   * Calculate XP required for a specific level
   */
  calculateXPForLevel(level: number): number {
    return level * level * 100;
  }

  /**
   * Calculate XP progress within current level
   */
  calculateXPProgress(level: number, currentXP: number): {
    currentLevelXP: number;
    nextLevelXP: number;
    progressXP: number;
    percentage: number;
  } {
    const currentLevelXP = this.calculateXPForLevel(level);
    const nextLevelXP = this.calculateXPForLevel(level + 1);
    const progressXP = currentXP - currentLevelXP;
    const neededXP = nextLevelXP - currentLevelXP;
    const percentage = Math.min((progressXP / neededXP) * 100, 100);

    return {
      currentLevelXP,
      nextLevelXP,
      progressXP,
      percentage
    };
  }

  /**
   * Add level reward with validation
   */
  async addLevelReward(data: {
    guildId: string;
    level: number;
    roleId: string;
    description: string;
  }) {
    return this.handleError(
      `add level reward for guild ${data.guildId} at level ${data.level}`,
      this.createLevelReward(data),
      null
    );
  }

  private async createLevelReward(data: {
    guildId: string;
    level: number;
    roleId: string;
    description: string;
  }) {
    // Check if reward already exists for this level
    const existing = await this.prisma.levelReward.findUnique({
      where: {
        guildId_level: {
          guildId: data.guildId,
          level: data.level
        }
      }
    });

    if (existing) {
      throw new Error(`Level reward already exists for level ${data.level}`);
    }

    const reward = await this.prisma.levelReward.create({ data });
    this.logSuccess(`added level reward for level ${data.level}`, data.description);
    return reward;
  }

  /**
   * Delete level reward
   */
  async deleteLevelReward(rewardId: number) {
    return this.handleError(
      `delete level reward ${rewardId}`,
      this.prisma.levelReward.delete({ where: { id: rewardId } })
        .then(reward => {
          this.logSuccess(`deleted level reward ${rewardId}`);
          return reward;
        }),
      null
    );
  }
}

// --- Moderation Service ---
export class ModerationService extends BaseService {
  /**
   * Get comprehensive moderation data
   */
  async getModerationData(guildId: string) {
    return this.handleError(
      `get moderation data for guild ${guildId}`,
      this.fetchModerationData(guildId),
      { warnings: [], quarantinedUsers: [], autoModRules: [] }
    );
  }

  private async fetchModerationData(guildId: string) {
    const [warnings, quarantinedUsers, autoModRules] = await Promise.all([
      this.prisma.warn.findMany({
        where: { guildId, active: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { 
          user: { select: { id: true, username: true } },
          moderator: { select: { id: true, username: true } }
        }
      }),
      this.prisma.quarantine.findMany({
        where: { guildId, active: true },
        orderBy: { quarantinedAt: 'desc' },
        include: { 
          user: { select: { id: true, username: true } },
          moderator: { select: { id: true, username: true } }
        }
      }),
      this.prisma.autoModRule.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return { warnings, quarantinedUsers, autoModRules };
  }

  /**
   * Get moderation statistics
   */
  async getModerationStats(guildId: string) {
    return this.handleError(
      `get moderation stats for guild ${guildId}`,
      this.calculateModerationStats(guildId),
      {
        totalWarnings: 0,
        activeWarnings: 0,
        totalQuarantined: 0,
        activeQuarantined: 0,
        autoModRulesEnabled: 0,
        recentActivity: []
      }
    );
  }

  private async calculateModerationStats(guildId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalWarnings,
      activeWarnings,
      totalQuarantined,
      activeQuarantined,
      autoModRulesEnabled,
      recentWarnings,
      recentQuarantine
    ] = await Promise.all([
      this.prisma.warn.count({ where: { guildId } }),
      this.prisma.warn.count({ where: { guildId, active: true } }),
      this.prisma.quarantine.count({ where: { guildId } }),
      this.prisma.quarantine.count({ where: { guildId, active: true } }),
      this.prisma.autoModRule.count({ where: { guildId, enabled: true } }),
      this.prisma.warn.count({ 
        where: { guildId, createdAt: { gte: sevenDaysAgo } } 
      }),
      this.prisma.quarantine.count({ 
        where: { guildId, quarantinedAt: { gte: sevenDaysAgo } } 
      })
    ]);

    return {
      totalWarnings,
      activeWarnings,
      totalQuarantined,
      activeQuarantined,
      autoModRulesEnabled,
      recentActivity: [
        { type: 'warnings', count: recentWarnings, period: '7 days' },
        { type: 'quarantine', count: recentQuarantine, period: '7 days' }
      ]
    };
  }

  /**
   * Delete warning with validation
   */
  async deleteWarning(warningId: number, moderatorId: string) {
    return this.handleError(
      `delete warning ${warningId}`,
      this.performWarningDeletion(warningId, moderatorId),
      null
    );
  }

  private async performWarningDeletion(warningId: number, moderatorId: string) {
    // Verify warning exists and get details
    const warning = await this.prisma.warn.findUnique({
      where: { id: warningId },
      include: { user: { select: { username: true } } }
    });

    if (!warning) {
      throw new Error(`Warning ${warningId} not found`);
    }

    // Delete the warning
    await this.prisma.warn.delete({ where: { id: warningId } });
    
    this.logSuccess(
      `deleted warning ${warningId}`, 
      `for user ${warning.user.username} by moderator ${moderatorId}`
    );

    return warning;
  }

  /**
   * Toggle automod rule status
   */
  async toggleAutoModRule(ruleId: number, enabled: boolean) {
    return this.handleError(
      `toggle automod rule ${ruleId} to ${enabled ? 'enabled' : 'disabled'}`,
      this.prisma.autoModRule.update({
        where: { id: ruleId },
        data: { enabled, updatedAt: new Date() }
      }).then(rule => {
        this.logSuccess(`toggled automod rule ${ruleId}`, `now ${enabled ? 'enabled' : 'disabled'}`);
        return rule;
      }),
      null
    );
  }
}

// --- Service Factory ---
export class ServiceFactory {
  constructor(private prisma: PrismaClient) {}

  createSettingsService(): SettingsService {
    return new SettingsService(this.prisma);
  }

  createLevelingService(): LevelingService {
    return new LevelingService(this.prisma);
  }

  createModerationService(): ModerationService {
    return new ModerationService(this.prisma);
  }
}

// Export singleton instances
export const serviceFactory = new ServiceFactory(
  globalThis.prisma || new PrismaClient()
);