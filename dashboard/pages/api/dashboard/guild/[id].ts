// dashboard/pages/api/dashboard/guild/[id].ts - Fixed Guild API
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../lib/auth';
<<<<<<< HEAD
import { PrismaInstance as prisma, default as databaseEvents } from '../../../../lib/database';
import { discordService } from '../../../../lib/discordService';
import { GuildWithFullStats, GuildSettings, DiscordGuildInfo } from '../../../../types';

const ALLOWED_GUILD_ID = process.env.TARGET_GUILD_ID;

async function handler(
  req: AuthenticatedRequest, 
  res: NextApiResponse<GuildWithFullStats | { message: string; error?: string; timestamp?: string }>
) {
=======
import { PrismaInstance as prisma, default as databaseEvents } from '../../../../lib/database'; // Use PrismaInstance and databaseEvents
import { discordService, DiscordGuildInfo } from '../../../../lib/discordService'; // Import DiscordGuildInfo
import { GuildWithFullStats, GuildSettings } from '@/types/index'; // Import shared types

const ALLOWED_GUILD_ID = process.env.TARGET_GUILD_ID;

// Helper function to calculate guild stats based on the FullGuildData
function calculateStatsFromFullData(guildData: NonNullable<Awaited<ReturnType<typeof databaseEvents.getGuildWithFullData>>>, memberCountFromDiscord: number): GuildWithFullStats['stats'] {
  const totalUsers = guildData.members?.length ?? 0;
  const engagementRate = memberCountFromDiscord > 0 && totalUsers > 0 ? Math.round((totalUsers / memberCountFromDiscord) * 100) : 0;
  const moderationRate = totalUsers > 0 && (guildData.warnings?.length ?? 0) > 0 ? Math.round(((guildData.warnings?.length ?? 0) / totalUsers) * 100) : 0;

  return {
    memberCount: memberCountFromDiscord,
    onlineCount: 0, // This will be filled by discordService.getGuildInfo
    ticketCount: guildData.tickets?.length ?? 0,
    pollCount: guildData.polls?.length ?? 0,
    giveawayCount: guildData.giveaways?.length ?? 0,
    warningCount: guildData.warnings?.length ?? 0,
    totalUsers,
    activeQuarantine: guildData.warnings?.filter(w => w.active).length ?? 0, // Assuming warnings can represent quarantine
    totalTrackers: 0, // Placeholder, assuming geizhals data is separate
    activePolls: guildData.polls?.filter(p => p.active).length ?? 0,
    activeGiveaways: guildData.giveaways?.filter(g => g.active && !g.ended).length ?? 0,
    openTickets: guildData.tickets?.filter(t => t.status !== 'CLOSED').length ?? 0,
    customCommands: 0, // Placeholder, needs specific count
    levelRewards: guildData.levelRewards?.length ?? 0,
    automodRules: guildData.autoModRules?.filter(r => r.enabled).length ?? 0,
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
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
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
<<<<<<< HEAD
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
=======
    if (!discordService.isReady()) {
      await discordService.initialize(); // Initialize with bot token
    }

    let guildDataFromDb = await databaseEvents.getGuildWithFullData(id);

    if (!guildDataFromDb) {
      const discordGuildInfo = await discordService.getGuildInfo(id);
      guildDataFromDb = await databaseEvents.createGuildWithDefaults(id, discordGuildInfo?.name || 'Unknown Guild');
      if (!guildDataFromDb) { // Should not happen if createGuildWithDefaults is robust
          return res.status(404).json({ message: 'Guild not found and could not be created.' });
      }
      // Re-fetch to include relations if createGuildWithDefaults doesn't
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
    calculatedStats.onlineCount = onlineCountFromDiscord; // Update online count from Discord API

    const response: GuildWithFullStats = {
      ...guildDataFromDb,
      settings: guildDataFromDb.settings as GuildSettings, // Ensure settings is typed
      stats: calculatedStats,
      discord: discordGuildAPIData || { // Fallback discord info
        id: id,
        name: guildDataFromDb.name,
        icon: null,
        iconURL: null,
        features: [],
        memberCount: memberCountFromDiscord,
        onlineCount: onlineCountFromDiscord,
        ownerId: guildDataFromDb.ownerId || undefined, // Ensure ownerId is present or undefined
        description: guildDataFromDb.description || null,
        createdAt: guildDataFromDb.createdAt || new Date(),
      },
      // Ensure all relations are correctly typed or mapped
      members: guildDataFromDb.members,
      warnings: guildDataFromDb.warnings,
      polls: guildDataFromDb.polls,
      giveaways: guildDataFromDb.giveaways,
      tickets: guildDataFromDb.tickets,
      logs: guildDataFromDb.logs,
      levelRewards: guildDataFromDb.levelRewards,
      autoModRules: guildDataFromDb.autoModRules,
    };


>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json(response);

  } catch (error: unknown) {
    console.error('Error fetching guild data:', error);
<<<<<<< HEAD
    return res.status(500).json({
=======
    res.status(500).json({
>>>>>>> 01df8e48f17518b570b4f64757b52f448eb715d0
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}