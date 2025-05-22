// dashboard/pages/api/dashboard/guilds.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../lib/auth';
import { DatabaseService } from '../../../lib/database';
import { discordService } from '../../../lib/discordService';

const ALLOWED_GUILD_ID = '554266392262737930';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Only return data for the specific allowed guild
    const guildData = await getGuildData(ALLOWED_GUILD_ID);
    
    if (!guildData) {
      return res.status(404).json({ message: 'Guild not found' });
    }

    // Return as array to match the expected format
    res.status(200).json([guildData]);
  } catch (error) {
    console.error('Error fetching guild data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getGuildData(guildId: string) {
  try {
    // Initialize Discord service if needed
    if (!discordService.isReady()) {
      await discordService.initialize();
    }

    // Get guild data from database
    let guild = await DatabaseService.getGuildSettings(guildId);
    
    // Get guild stats
    const stats = await DatabaseService.getGuildStats(guildId);
    
    // Get Discord guild info
    let memberCount = 0;
    let guildName = guild.name;
    
    try {
      const discordGuild = await discordService.getGuildInfo(guildId);
      if (discordGuild) {
        memberCount = discordGuild.memberCount || 0;
        guildName = discordGuild.name;
        
        // Update guild name if it changed
        if (discordGuild.name !== guild.name) {
          await DatabaseService.updateGuildSettings(guildId, { name: discordGuild.name });
        }
      }
    } catch (discordError) {
      console.warn('Discord API unavailable, using database data only');
      memberCount = stats.totalUsers; // Fallback to database user count
    }

    return {
      id: guildId,
      name: guildName,
      memberCount,
      stats: {
        totalUsers: stats.totalUsers,
        totalWarns: stats.totalWarns,
        activeQuarantine: stats.activeQuarantine,
        totalTrackers: stats.totalTrackers,
        activePolls: stats.activePolls,
        activeGiveaways: stats.activeGiveaways,
        openTickets: stats.openTickets,
        customCommands: stats.customCommands,
        levelingEnabled: guild.enableLeveling,
        moderationEnabled: guild.enableModeration,
        geizhalsEnabled: guild.enableGeizhals,
        enablePolls: guild.enablePolls,
        enableGiveaways: guild.enableGiveaways,
        enableTickets: guild.enableTickets,
      }
    };
  } catch (error) {
    console.error(`Error getting guild data for ${guildId}:`, error);
    return null;
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}