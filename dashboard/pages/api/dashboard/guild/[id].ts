// dashboard/pages/api/dashboard/guild/[id].ts - Fixed Guild API
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../lib/auth';
import { PrismaInstance as prisma, default as databaseEvents } from '../../../../lib/database';
import { discordService } from '../../../../lib/discordService';
import { GuildWithFullStats, GuildSettings, DiscordGuildInfo } from '../../../../types';

const ALLOWED_GUILD_ID = process.env.TARGET_GUILD_ID;

async function handler(
  req: AuthenticatedRequest, 
  res: NextApiResponse<GuildWithFullStats | { message: string; error?: string; timestamp?: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  if (id !== ALLOWED_GUILD_ID) {
    return res.status(403).json({ message: 'Access denied to this guild' });
  }

  try {
    // Initialize Discord service if needed
    if (!discordService.isReady()) {
      await discordService.initialize();
    }

    // Get guild data from database
    let guildData = await databaseEvents.getGuildWithFullData(id);

    // Create guild if it doesn't exist
    if (!guildData) {
      const discordGuildInfo = await discordService.getGuildInfo(id);
      if (discordGuildInfo) {
        await databaseEvents.createGuild(id, discordGuildInfo.name);
        guildData = await databaseEvents.getGuildWithFullData(id);
      }
      
      if (!guildData) {
        return res.status(404).json({ message: 'Guild not found and could not be created.' });
      }
    }

    // Get Discord guild info
    const discordGuildInfo: DiscordGuildInfo | null = await discordService.getGuildInfo(id);
    const memberCount = discordGuildInfo?.memberCount ?? guildData.members?.length ?? 0;
    const onlineCount = discordGuildInfo?.onlineCount ?? 0;

    // Update guild name if changed
    if (discordGuildInfo && discordGuildInfo.name !== guildData.name) {
      try {
        await databaseEvents.updateGuildSettings(id, { name: discordGuildInfo.name });
        guildData.name = discordGuildInfo.name;
      } catch (updateError) {
        console.warn('Failed to update guild name:', updateError);
      }
    }

    // Calculate stats
    const stats = {
      memberCount,
      onlineCount,
      ticketCount: guildData.tickets?.length ?? 0,
      pollCount: guildData.polls?.length ?? 0,
      giveawayCount: guildData.giveaways?.length ?? 0,
      warningCount: guildData.warnings?.length ?? 0,
      totalUsers: guildData.members?.length ?? 0,
      activeQuarantine: await prisma.quarantine.count({ where: { guildId: id, active: true } }),
      totalTrackers: 0, // Placeholder for Geizhals
      activePolls: guildData.polls?.filter(p => p.active).length ?? 0,
      activeGiveaways: guildData.giveaways?.filter(g => g.active && !g.ended).length ?? 0,
      openTickets: guildData.tickets?.filter(t => t.status !== 'CLOSED').length ?? 0,
      customCommands: await prisma.customCommand.count({ where: { guildId: id, enabled: true } }),
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

    const response: GuildWithFullStats = {
      ...guildData,
      settings: guildData.settings as GuildSettings,
      stats,
      discord: discordGuildInfo || {
        id: id,
        name: guildData.name,
        icon: null,
        iconURL: null,
        features: [],
        memberCount,
        onlineCount,
        ownerId: guildData.ownerId || undefined,
        description: guildData.description || null,
        createdAt: guildData.createdAt || new Date(),
      },
      members: guildData.members,
      warnings: guildData.warnings,
      polls: guildData.polls,
      giveaways: guildData.giveaways,
      tickets: guildData.tickets,
      logs: guildData.logs,
      levelRewards: guildData.levelRewards,
      autoModRules: guildData.autoModRules,
    };

    // Set cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json(response);

  } catch (error: unknown) {
    console.error('Error fetching guild data:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}