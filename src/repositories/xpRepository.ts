import { and, eq, desc, gte, sql } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { userXp, xpRewards, xpMultipliers, xpSettings } from '../database/schema/xp';
import { users } from '../database/schema/users';
import { logger } from '../utils/logger';

export interface UserXPData {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  lastXpGain: Date;
  lastVoiceActivity?: Date | null;
}

export interface XPReward {
  guildId: string;
  level: number;
  roleId: string;
}

export interface XPMultiplier {
  guildId: string;
  targetId: string;
  targetType: 'role' | 'channel';
  multiplier: number;
}

export interface XPSettings {
  guildId: string;
  ignoredChannels: string[];
  ignoredRoles: string[];
  noXpChannels: string[];
  doubleXpChannels: string[];
  roleMultipliers: Record<string, number>;
  levelUpRewardsEnabled: boolean;
  stackRoleRewards: boolean;
}

export class XPRepository {
  // Get user XP data
  async getUserXP(userId: string, guildId: string): Promise<UserXPData | null> {
    try {
      const [result] = await getDatabase()
        .select()
        .from(userXp)
        .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)))
        .limit(1);

      return result || null;
    } catch (error) {
      logger.error('Failed to get user XP:', error);
      return null;
    }
  }

  // Create or update user XP
  async upsertUserXP(data: Partial<UserXPData> & { userId: string; guildId: string }): Promise<boolean> {
    try {
      await getDatabase()
        .insert(userXp)
        .values({
          userId: data.userId,
          guildId: data.guildId,
          xp: data.xp ?? 0,
          level: data.level ?? 0,
          lastXpGain: data.lastXpGain ?? new Date(),
          lastVoiceActivity: data.lastVoiceActivity,
        })
        .onConflictDoUpdate({
          target: [userXp.userId, userXp.guildId],
          set: {
            xp: data.xp ?? sql`${userXp.xp}`,
            level: data.level ?? sql`${userXp.level}`,
            lastXpGain: data.lastXpGain ?? sql`${userXp.lastXpGain}`,
            lastVoiceActivity: data.lastVoiceActivity ?? sql`${userXp.lastVoiceActivity}`,
            updatedAt: new Date(),
          },
        });

      return true;
    } catch (error) {
      logger.error('Failed to upsert user XP:', error);
      return false;
    }
  }

  // Get guild leaderboard
  async getLeaderboard(guildId: string, limit: number, offset: number): Promise<Array<UserXPData & { username?: string; avatarUrl?: string }>> {
    try {
      const results = await getDatabase()
        .select({
          userId: userXp.userId,
          guildId: userXp.guildId,
          xp: userXp.xp,
          level: userXp.level,
          lastXpGain: userXp.lastXpGain,
          lastVoiceActivity: userXp.lastVoiceActivity,
          username: users.username,
          avatarUrl: users.avatarUrl,
        })
        .from(userXp)
        .leftJoin(users, eq(users.id, userXp.userId))
        .where(eq(userXp.guildId, guildId))
        .orderBy(desc(userXp.xp))
        .limit(limit)
        .offset(offset);

      return results.map(r => ({
        ...r,
        username: r.username ?? undefined,
        avatarUrl: r.avatarUrl ?? undefined,
      }));
    } catch (error) {
      logger.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  // Get total users with XP in guild
  async getTotalUsersWithXP(guildId: string): Promise<number> {
    try {
      const [result] = await getDatabase()
        .select({ count: sql<number>`COUNT(*)` })
        .from(userXp)
        .where(eq(userXp.guildId, guildId));

      return result?.count || 0;
    } catch (error) {
      logger.error('Failed to get total users with XP:', error);
      return 0;
    }
  }

  // Get user rank
  async getUserRank(userId: string, guildId: string, userXpAmount: number): Promise<number> {
    try {
      const [result] = await getDatabase()
        .select({
          rank: sql<number>`COUNT(*) + 1`,
        })
        .from(userXp)
        .where(and(
          eq(userXp.guildId, guildId),
          gte(userXp.xp, userXpAmount),
          sql`${userXp.userId} != ${userId}`
        ));

      return result?.rank || 1;
    } catch (error) {
      logger.error('Failed to get user rank:', error);
      return 1;
    }
  }

  // Get XP rewards for guild
  async getXPRewards(guildId: string): Promise<XPReward[]> {
    try {
      const results = await getDatabase()
        .select()
        .from(xpRewards)
        .where(eq(xpRewards.guildId, guildId))
        .orderBy(xpRewards.level);

      return results;
    } catch (error) {
      logger.error('Failed to get XP rewards:', error);
      return [];
    }
  }

  // Get XP multipliers for guild
  async getXPMultipliers(guildId: string): Promise<XPMultiplier[]> {
    try {
      const results = await getDatabase()
        .select()
        .from(xpMultipliers)
        .where(eq(xpMultipliers.guildId, guildId));

      return results.map(r => ({
        guildId: r.guildId,
        targetId: r.targetId,
        targetType: r.targetType as 'role' | 'channel',
        multiplier: r.multiplier,
      }));
    } catch (error) {
      logger.error('Failed to get XP multipliers:', error);
      return [];
    }
  }

  // Get XP settings for guild
  async getXPSettings(guildId: string): Promise<XPSettings | null> {
    try {
      const [result] = await getDatabase()
        .select()
        .from(xpSettings)
        .where(eq(xpSettings.guildId, guildId))
        .limit(1);

      if (!result) return null;

      return {
        guildId: result.guildId,
        ignoredChannels: JSON.parse(result.ignoredChannels),
        ignoredRoles: JSON.parse(result.ignoredRoles),
        noXpChannels: JSON.parse(result.noXpChannels),
        doubleXpChannels: JSON.parse(result.doubleXpChannels),
        roleMultipliers: JSON.parse(result.roleMultipliers),
        levelUpRewardsEnabled: result.levelUpRewardsEnabled,
        stackRoleRewards: result.stackRoleRewards,
      };
    } catch (error) {
      logger.error('Failed to get XP settings:', error);
      return null;
    }
  }

  // Delete user XP
  async deleteUserXP(userId: string, guildId: string): Promise<boolean> {
    try {
      await getDatabase()
        .delete(userXp)
        .where(and(eq(userXp.userId, userId), eq(userXp.guildId, guildId)));

      return true;
    } catch (error) {
      logger.error('Failed to delete user XP:', error);
      return false;
    }
  }
}

// Export singleton instance
export const xpRepository = new XPRepository();