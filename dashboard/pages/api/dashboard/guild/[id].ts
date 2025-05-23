// dashboard/pages/api/dashboard/guild/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../lib/auth';
import { DatabaseService } from '../../../../lib/database';
import { discordService } from '../../../../lib/discordService';

const ALLOWED_GUILD_ID = '554266392262737930';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  // Only allow access to the specific guild
  if (id !== ALLOWED_GUILD_ID) {
    return res.status(403).json({ message: 'Access denied to this guild' });
  }

  try {
    // Initialize Discord service if needed
    if (!discordService.isReady()) {
      await discordService.initialize();
    }

    // Get guild data from database
    const guildData = await DatabaseService.getGuildWithFullData(id);
    
    if (!guildData) {
      // Create guild if it doesn't exist
      const newGuild = await DatabaseService.getGuildSettings(id);
      
      const response = {
        id: newGuild.id,
        name: newGuild.name,
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
          levelingEnabled: newGuild.enableLeveling,
          moderationEnabled: newGuild.enableModeration,
          geizhalsEnabled: newGuild.enableGeizhals,
          enablePolls: newGuild.enablePolls,
          enableGiveaways: newGuild.enableGiveaways,
          enableTickets: newGuild.enableTickets
        },
        settings: {
          enableLeveling: newGuild.enableLeveling,
          enableModeration: newGuild.enableModeration,
          enableGeizhals: newGuild.enableGeizhals,
          enablePolls: newGuild.enablePolls,
          enableGiveaways: newGuild.enableGiveaways,
          enableTickets: newGuild.enableTickets,
          enableAutomod: newGuild.enableAutomod,
          enableMusic: newGuild.enableMusic,
          enableJoinToCreate: newGuild.enableJoinToCreate
        }
      };

      return res.status(200).json(response);
    }

    // Get additional data from Discord API if available
    try {
      const [discordGuild, memberCount] = await Promise.all([
        discordService.getGuildInfo(id),
        discordService.getGuildMemberCount(id)
      ]);

      // Update guild name if it changed on Discord
      if (discordGuild && discordGuild.name !== guildData.name) {
        await DatabaseService.updateGuildSettings(id, { name: discordGuild.name });
        guildData.name = discordGuild.name;
      }

      // Use Discord member count if available, otherwise fall back to database count
      const actualMemberCount = memberCount || guildData.memberCount;

      const response = {
        id: guildData.id,
        name: guildData.name,
        memberCount: actualMemberCount,
        iconURL: discordGuild?.iconURL || null,
        stats: {
          ...guildData.stats,
          levelingEnabled: guildData.settings.enableLeveling,
          moderationEnabled: guildData.settings.enableModeration,
          geizhalsEnabled: guildData.settings.enableGeizhals,
          enablePolls: guildData.settings.enablePolls,
          enableGiveaways: guildData.settings.enableGiveaways,
          enableTickets: guildData.settings.enableTickets
        },
        settings: guildData.settings
      };

      res.status(200).json(response);
    } catch (discordError) {
      // Discord API error - return database data only
      console.warn('Discord API unavailable, using database data only');
      
      const response = {
        id: guildData.id,
        name: guildData.name,
        memberCount: guildData.memberCount,
        iconURL: null,
        stats: {
          ...guildData.stats,
          levelingEnabled: guildData.settings.enableLeveling,
          moderationEnabled: guildData.settings.enableModeration,
          geizhalsEnabled: guildData.settings.enableGeizhals,
          enablePolls: guildData.settings.enablePolls,
          enableGiveaways: guildData.settings.enableGiveaways,
          enableTickets: guildData.settings.enableTickets
        },
        settings: guildData.settings
      };

      res.status(200).json(response);
    }

  } catch (error) {
    console.error('Error fetching guild data:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}