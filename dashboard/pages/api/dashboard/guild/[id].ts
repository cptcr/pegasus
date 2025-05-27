// dashboard/pages/api/dashboard/guild/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../lib/auth';
import { default as databaseEvents } from '../../../../lib/database';
import { discordService, DiscordGuildInfo } from '../../../../lib/discordService';
import { GuildWithFullStats, GuildSettings, FullGuildData } from '@/types/index';

const ALLOWED_GUILD_ID = process.env.TARGET_GUILD_ID;

interface DiscordGuildResponse {
  memberCount?: number;
  onlineCount?: number;
  name?: string;
  id: string;
  icon?: string | null;
  features?: string[];
  ownerId?: string;
  description?: string | null;
  createdAt?: Date;
}

function calculateStatsFromFullData(guildData: FullGuildData, memberCountFromDiscord: number): GuildWithFullStats['stats'] {
  const totalUsers = guildData.members?.length ?? 0;
  const engagementRate = memberCountFromDiscord > 0 && totalUsers > 0 ? Math.round((totalUsers / memberCountFromDiscord) * 100) : 0;
  const moderationRate = totalUsers > 0 && (guildData.warnings?.length ?? 0) > 0 ? Math.round(((guildData.warnings?.length ?? 0) / totalUsers) * 100) : 0;

  return {
    memberCount: memberCountFromDiscord,
    onlineCount: 0,
    ticketCount: guildData.tickets?.length ?? 0,
    pollCount: guildData.polls?.length ?? 0,
    giveawayCount: guildData.giveaways?.length ?? 0,
    warningCount: guildData.warnings?.length ?? 0,
    totalUsers,
    activeQuarantine: guildData.warnings?.filter((w: { active: boolean }) => w.active).length ?? 0,
    totalTrackers: 0,
    activePolls: guildData.polls?.filter((p: { active: boolean }) => p.active).length ?? 0,
    activeGiveaways: guildData.giveaways?.filter((g: { active: boolean; ended: boolean }) => g.active && !g.ended).length ?? 0,
    openTickets: guildData.tickets?.filter((t: { status: string }) => t.status !== 'CLOSED').length ?? 0,
    customCommands: 0,
    levelRewards: guildData.levelRewards?.length ?? 0,
    automodRules: guildData.autoModRules?.filter((r: { enabled: boolean }) => r.enabled).length ?? 0,
    levelingEnabled: guildData.enableLeveling ?? true,
    moderationEnabled: guildData.enableModeration ?? true,
    geizhalsEnabled: guildData.enableGeizhals ?? false,
    enableAutomod: guildData.enableAutomod ?? false,
    enableMusic: guildData.enableMusic ?? false,
    enableJoinToCreate: guildData.enableJoinToCreate ?? false,
    engagementRate,
    moderationRate,
    lastUpdated: new Date().toISOString(),
  };
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse<GuildWithFullStats | { message: string; error?: string; timestamp?: string }>) {
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
    if (!discordService.isReady()) {
      await discordService.initialize();
    }

    let guildDataFromDb = await databaseEvents.getGuildWithFullData(id);

    if (!guildDataFromDb) {
      const discordGuildInfo = await discordService.getGuildInfo(id);
      guildDataFromDb = await databaseEvents.createGuildWithDefaults(id, discordGuildInfo?.name || 'Unknown Guild');
      if (!guildDataFromDb) {
          return res.status(404).json({ message: 'Guild not found and could not be created.' });
      }
      guildDataFromDb = await databaseEvents.getGuildWithFullData(id);
      if (!guildDataFromDb) {
          return res.status(500).json({message: 'Failed to retrieve guild after creation.'});
      }
    }

    const discordGuildAPIData: DiscordGuildInfo | null = await discordService.getGuildInfo(id);
    const memberCountFromDiscord = discordGuildAPIData?.memberCount ?? guildDataFromDb.members?.length ?? 0;
    const onlineCountFromDiscord = discordGuildAPIData?.onlineCount ?? 0;

    if (discordGuildAPIData && discordGuildAPIData.name !== guildDataFromDb.name) {
      try {
        const updatedSettings = { ...(guildDataFromDb.settings as GuildSettings || {}), name: discordGuildAPIData.name };
        await databaseEvents.updateGuildSettings(id, updatedSettings);
        guildDataFromDb.name = discordGuildAPIData.name;
      } catch (updateError) {
        console.warn('Failed to update guild name in DB:', updateError);
      }
    }

    const calculatedStats = calculateStatsFromFullData(guildDataFromDb, memberCountFromDiscord);
    calculatedStats.onlineCount = onlineCountFromDiscord;

    const discordResponse: DiscordGuildResponse = discordGuildAPIData || {
      id: id,
      name: guildDataFromDb.name,
      icon: null,
      features: [],
      memberCount: memberCountFromDiscord,
      onlineCount: onlineCountFromDiscord,
      ownerId: guildDataFromDb.ownerId || undefined,
      description: guildDataFromDb.description || null,
      createdAt: guildDataFromDb.createdAt || new Date(),
    };

    const response: GuildWithFullStats = {
      ...guildDataFromDb,
      settings: guildDataFromDb.settings as GuildSettings,
      stats: calculatedStats,
      discord: discordResponse,
      members: guildDataFromDb.members,
      warnings: guildDataFromDb.warnings,
      polls: guildDataFromDb.polls,
      giveaways: guildDataFromDb.giveaways,
      tickets: guildDataFromDb.tickets,
      logs: guildDataFromDb.logs,
      levelRewards: guildDataFromDb.levelRewards,
      autoModRules: guildDataFromDb.autoModRules,
    };

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json(response);

  } catch (error: unknown) {
    console.error('Error fetching guild data:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}