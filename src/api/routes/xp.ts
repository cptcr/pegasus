import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database/connection';
import { guildSettings, xpRewards, members } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas
const xpSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  xpRate: z.number().min(1).max(100).optional(),
  xpCooldown: z.number().min(0).max(3600).optional(),
  levelUpMessage: z.string().max(500).optional(),
  levelUpChannel: z.string().optional(),
  announceLevelUp: z.boolean().optional(),
  xpBlacklistRoles: z.array(z.string()).optional(),
  xpBlacklistChannels: z.array(z.string()).optional(),
  xpMultiplierRoles: z.record(z.string(), z.number()).optional(),
});

const roleRewardSchema = z.object({
  level: z.number().min(1).max(1000),
  roleId: z.string(),
});

// PATCH /guilds/{guildId}/xp/settings - Update XP settings
router.patch('/:guildId/xp/settings', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const validation = xpSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const db = getDatabase();
    const updates = validation.data;

    // Ensure guild settings exist
    const [existingSettings] = await db
      .select()
      .from(guildSettings)
      .where(eq(guildSettings.guildId, guildId))
      .limit(1);

    if (!existingSettings) {
      // Create settings if they don't exist
      await db.insert(guildSettings).values({
        guildId,
        xpEnabled: updates.enabled,
        xpPerMessage: updates.xpRate,
        xpCooldown: updates.xpCooldown,
        levelUpMessage: updates.levelUpMessage,
        levelUpChannel: updates.levelUpChannel,
        xpAnnounceLevelUp: updates.announceLevelUp,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Update existing settings
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (updates.enabled !== undefined) updateData.xpEnabled = updates.enabled;
      if (updates.xpRate !== undefined) updateData.xpPerMessage = updates.xpRate;
      if (updates.xpCooldown !== undefined) updateData.xpCooldown = updates.xpCooldown;
      if (updates.levelUpMessage !== undefined) updateData.levelUpMessage = updates.levelUpMessage;
      if (updates.levelUpChannel !== undefined) updateData.levelUpChannel = updates.levelUpChannel;
      if (updates.announceLevelUp !== undefined)
        updateData.xpAnnounceLevelUp = updates.announceLevelUp;

      await db.update(guildSettings).set(updateData).where(eq(guildSettings.guildId, guildId));
    }

    logger.info(`Updated XP settings for guild ${guildId}`);

    return res.json({
      success: true,
      message: 'XP settings updated successfully',
    });
  } catch (error) {
    logger.error('Error updating XP settings:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update XP settings',
    });
  }
});

// POST /guilds/{guildId}/xp/rewards - Add role reward
router.post('/:guildId/xp/rewards', async (req: Request, res: Response) => {
  const { guildId } = req.params;

  try {
    const validation = roleRewardSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const db = getDatabase();
    const { level, roleId } = validation.data;

    // Check if reward already exists for this level
    const [existingReward] = await db
      .select()
      .from(xpRewards)
      .where(and(eq(xpRewards.guildId, guildId), eq(xpRewards.level, level)))
      .limit(1);

    if (existingReward) {
      return res.status(409).json({
        error: 'Conflict',
        message: `A role reward already exists for level ${level}`,
      });
    }

    // Create new role reward
    const [newReward] = await db
      .insert(xpRewards)
      .values({
        guildId,
        level,
        roleId,
        createdAt: new Date(),
      })
      .returning();

    logger.info(`Created XP role reward for level ${level} in guild ${guildId}`);

    return res.status(201).json({
      success: true,
      reward: {
        level: newReward.level,
        roleId: newReward.roleId,
      },
    });
  } catch (error) {
    logger.error('Error creating role reward:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create role reward',
    });
  }
});

// DELETE /guilds/{guildId}/xp/rewards/:level - Remove role reward
router.delete('/:guildId/xp/rewards/:level', async (req: Request, res: Response) => {
  const { guildId, level } = req.params;

  try {
    const db = getDatabase();

    // Check if reward exists
    const [existingReward] = await db
      .select()
      .from(xpRewards)
      .where(and(eq(xpRewards.level, parseInt(level)), eq(xpRewards.guildId, guildId)))
      .limit(1);

    if (!existingReward) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Role reward not found',
      });
    }

    // Delete the reward
    await db
      .delete(xpRewards)
      .where(and(eq(xpRewards.level, parseInt(level)), eq(xpRewards.guildId, guildId)));

    logger.info(`Deleted XP role reward for level ${level} from guild ${guildId}`);

    return res.json({
      success: true,
      message: 'Role reward deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting role reward:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete role reward',
    });
  }
});

// POST /guilds/{guildId}/xp/reset - Reset XP data
router.post('/:guildId/xp/reset', async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const { resetLevels = true, resetRewards = false, keepSettings = true } = req.body;

  try {
    const db = getDatabase();

    await db.transaction(async tx => {
      if (resetLevels) {
        // Reset all member XP and levels
        await tx
          .update(members)
          .set({
            xp: 0,
            level: 0,
            messages: 0,
          })
          .where(eq(members.guildId, guildId));

        logger.info(`Reset XP levels for all members in guild ${guildId}`);
      }

      if (resetRewards) {
        // Delete all role rewards
        await tx.delete(xpRewards).where(eq(xpRewards.guildId, guildId));

        logger.info(`Reset XP role rewards for guild ${guildId}`);
      }

      if (!keepSettings) {
        // Reset XP settings to defaults
        await tx
          .update(guildSettings)
          .set({
            xpEnabled: true,
            xpPerMessage: 15,
            xpCooldown: 60,
            levelUpMessage: "Congratulations {user}! You've reached level {level}!",
            levelUpChannel: null,
            xpAnnounceLevelUp: true,
            updatedAt: new Date(),
          })
          .where(eq(guildSettings.guildId, guildId));

        logger.info(`Reset XP settings for guild ${guildId}`);
      }
    });

    return res.json({
      success: true,
      message: 'XP data reset successfully',
      reset: {
        levels: resetLevels,
        rewards: resetRewards,
        settings: !keepSettings,
      },
    });
  } catch (error) {
    logger.error('Error resetting XP data:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset XP data',
    });
  }
});

// GET /guilds/{guildId}/xp/user/{userId} - Get specific user XP data
router.get('/:guildId/xp/user/:userId', async (req: Request, res: Response) => {
  const { guildId, userId } = req.params;

  try {
    const db = getDatabase();

    const [member] = await db
      .select()
      .from(members)
      .where(and(eq(members.guildId, guildId), eq(members.userId, userId)))
      .limit(1);

    if (!member) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Member not found',
      });
    }

    // Calculate XP needed for next level
    const currentLevelXp = member.level * member.level * 100;
    const nextLevelXp = (member.level + 1) * (member.level + 1) * 100;
    const xpProgress = member.xp - currentLevelXp;
    const xpNeeded = nextLevelXp - currentLevelXp;

    return res.json({
      userId: member.userId,
      xp: member.xp,
      level: member.level,
      messages: member.messages,
      xpProgress,
      xpNeeded,
      progressPercentage: Math.floor((xpProgress / xpNeeded) * 100),
      lastXpGain: null,
    });
  } catch (error) {
    logger.error('Error fetching user XP:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user XP data',
    });
  }
});

// PATCH /guilds/{guildId}/xp/user/{userId} - Manually adjust user XP
router.patch('/:guildId/xp/user/:userId', async (req: Request, res: Response) => {
  const { guildId, userId } = req.params;
  const { xp, level, addXp, addLevel } = req.body;

  try {
    const db = getDatabase();

    // Get current member data
    const [member] = await db
      .select()
      .from(members)
      .where(and(eq(members.guildId, guildId), eq(members.userId, userId)))
      .limit(1);

    if (!member) {
      // Create member if doesn't exist
      await db.insert(members).values({
        guildId,
        userId,
        xp: xp || 0,
        level: level || 0,
        messages: 0,
        joinedAt: new Date(),
      });
    } else {
      // Update member XP/level
      const updateData: any = {};

      if (xp !== undefined) {
        updateData.xp = xp;
      } else if (addXp !== undefined) {
        updateData.xp = member.xp + addXp;
      }

      if (level !== undefined) {
        updateData.level = level;
      } else if (addLevel !== undefined) {
        updateData.level = member.level + addLevel;
      }

      await db
        .update(members)
        .set(updateData)
        .where(and(eq(members.guildId, guildId), eq(members.userId, userId)));
    }

    logger.info(`Manually adjusted XP for user ${userId} in guild ${guildId}`);

    return res.json({
      success: true,
      message: 'User XP updated successfully',
    });
  } catch (error) {
    logger.error('Error updating user XP:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user XP',
    });
  }
});

export const xpRouter = router;
