// dashboard/pages/api/dashboard/guild/[id].ts (Enhanced Real-time)
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

    // Get real-time guild data from database
    const guildData = await DatabaseService.getGuildWithFullData(id);
    
    if (!guildData) {
      return res.status(404).json({ message: 'Guild not found' });
    }

    // Get live Discord guild info
    let discordGuild = null;
    let memberCount = guildData.memberCount;
    
    try {
      const [discordGuildInfo, discordMemberCount] = await Promise.all([
        discordService.getGuildInfo(id),
        discordService.getGuildMemberCount(id)
      ]);
      
      discordGuild = discordGuildInfo;
      memberCount = discordMemberCount || guildData.memberCount;

      // Update guild name if it changed on Discord
      if (discordGuild && discordGuild.name !== guildData.name) {
        await DatabaseService.updateGuildSettings(id, { name: discordGuild.name });
        guildData.name = discordGuild.name;
      }
    } catch (discordError) {
      console.warn('Discord API unavailable, using database data only');
    }

    // Prepare response with live data
    const response = {
      id: guildData.id,
      name: guildData.name,
      memberCount: memberCount,
      iconURL: discordGuild?.iconURL || null,
      stats: {
        ...guildData.stats,
        // Add computed fields
        engagementRate: guildData.stats.totalUsers > 0 ? 
          Math.round((guildData.stats.totalUsers / memberCount) * 100) : 0,
        moderationRate: guildData.stats.totalWarns > 0 ? 
          Math.round((guildData.stats.totalWarns / guildData.stats.totalUsers) * 100) : 0,
        lastUpdated: new Date().toISOString()
      },
      settings: guildData.settings,
      config: guildData.config,
      // Add real-time status
      status: {
        botOnline: discordGuild !== null,
        databaseConnected: true,
        lastSync: new Date().toISOString()
      }
    };

    // Set cache headers for real-time updates
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching guild data:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}