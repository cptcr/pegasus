// dashboard/pages/api/dashboard/moderation/[guildId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseService } from '../../../lib/database';
import { discordService } from '../../../lib/discordService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  try {
    // Initialize Discord service if needed
    if (!discordService.isReady()) {
      await discordService.initialize();
    }

    const moderationData = await DatabaseService.getModerationData(guildId);

    // Enhance user data with Discord information
    const enhancedWarnings = await Promise.all(
      moderationData.warnings.map(async (warning) => {
        try {
          const [user, moderator] = await Promise.all([
            discordService.getUserById(warning.userId),
            discordService.getUserById(warning.moderatorId)
          ]);

          return {
            ...warning,
            user: {
              ...warning.user,
              username: user?.username || warning.user.username,
              avatarURL: user?.displayAvatarURL() || null
            },
            moderator: {
              ...warning.moderator,
              username: moderator?.username || warning.moderator.username,
              avatarURL: moderator?.displayAvatarURL() || null
            }
          };
        } catch (error) {
          console.error(`Error enhancing warning ${warning.id}:`, error);
          return warning;
        }
      })
    );

    const enhancedQuarantine = await Promise.all(
      moderationData.quarantineEntries.map(async (entry) => {
        try {
          const moderator = await discordService.getUserById(entry.moderatorId);

          return {
            ...entry,
            moderator: {
              ...entry.moderator,
              username: moderator?.username || entry.moderator.username,
              avatarURL: moderator?.displayAvatarURL() || null
            }
          };
        } catch (error) {
          console.error(`Error enhancing quarantine entry ${entry.id}:`, error);
          return entry;
        }
      })
    );

    res.status(200).json({
      warnings: enhancedWarnings,
      quarantineEntries: enhancedQuarantine,
      automodRules: moderationData.automodRules
    });
  } catch (error) {
    console.error('Error fetching moderation data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}