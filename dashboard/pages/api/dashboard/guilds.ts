// dashboard/pages/api/dashboard/guilds.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../lib/auth';
import { discordService } from '../../../lib/discordService';
import databaseEvents from '../../../lib/database';

interface GuildInfo {
  id: string;
  name: string;
  memberCount?: number;
  iconURL?: string | null;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse<GuildInfo[] | { message: string; error?: string }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!discordService.isReady()) {
      await discordService.initialize();
    }

    const discordGuilds = await discordService.getAllGuilds();
    const guildsWithDetails: GuildInfo[] = [];

    for (const discordGuild of discordGuilds) {
      try {
        const guildInfo = await discordService.getGuildInfo(discordGuild.id);
        
        if (guildInfo) {
          try {
            await databaseEvents.syncGuild(discordGuild.id, guildInfo.name);
          } catch (syncError) {
            console.error('Error syncing guild:', syncError);
          }

          guildsWithDetails.push({
            id: guildInfo.id,
            name: guildInfo.name,
            memberCount: guildInfo.memberCount,
            iconURL: guildInfo.iconURL
          });
        }
      } catch (guildError) {
        console.warn(`Failed to get info for guild ${discordGuild.id}:`, guildError);
        
        guildsWithDetails.push({
          id: discordGuild.id,
          name: discordGuild.name,
          memberCount: 0,
          iconURL: null
        });
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.status(200).json(guildsWithDetails);

  } catch (error: unknown) {
    console.error('Error fetching guilds:', error);
    res.status(500).json({
      message: 'Failed to fetch guilds',
      error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
    });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}