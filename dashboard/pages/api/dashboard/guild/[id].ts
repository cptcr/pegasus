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
    // Initialize Discord service if needed (don't throw on failure)
    try {
      if (!discordService.isReady()) {
        await discordService.initialize();
      }
    } catch (discordError) {
      console.warn('Discord service initialization failed, continuing with database-only mode');
    }

    // Get guild data from database with fallback
    let guildData;
    try {
      // Try the full stats method first
      if (typeof DatabaseService.getGuildWithFullStats === 'function') {
        guildData = await DatabaseService.getGuildWithFullStats(id);
      } else {
        // Fallback to basic guild settings and manual stats gathering
        console.log('Using fallback method for guild data');
        guildData = await getGuildDataFallback(id);
      }
    } catch (dbError) {
      console.error('Database error, creating default guild:', dbError);
      guildData = await createDefaultGuild(id);
    }
    
    if (!guildData) {
      guildData = await createDefaultGuild(id);
    }

    // Get live Discord guild info (with fallback)
    let discordGuild = null;
    let memberCount = 0;
    
    try {
      const [discordGuildInfo, discordMemberCount] = await Promise.all([
        discordService.getGuildInfo(id),
        discordService.getGuildMemberCount(id)
      ]);
      
      discordGuild = discordGuildInfo;
      memberCount = discordMemberCount || 0;

      // Update guild name if it changed on Discord
      if (discordGuild && discordGuild.name !== guildData.name) {
        try {
          await DatabaseService.updateGuildSettings(id, { name: discordGuild.name });
          guildData.name = discordGuild.name;
        } catch (updateError) {
          console.warn('Failed to update guild name:', updateError);
        }
      }
    } catch (discordError) {
      console.warn('Discord API unavailable, using database data only');
      // Use database user count as fallback
      memberCount = guildData.userLevels?.length || 0;
    }

    // Calculate real stats from available data
    const stats = calculateGuildStats(guildData, memberCount);

    // Prepare response with live data
    const response = {
      id: guildData.id,
      name: guildData.name || 'Unknown Guild',
      memberCount: memberCount,
      iconURL: discordGuild?.iconURL || null,
      stats: {
        ...stats,
        lastUpdated: new Date().toISOString()
      },
      settings: {
        enableLeveling: guildData.enableLeveling ?? true,
        enableModeration: guildData.enableModeration ?? true,
        enableGeizhals: guildData.enableGeizhals ?? false,
        enablePolls: guildData.enablePolls ?? true,
        enableGiveaways: guildData.enableGiveaways ?? true,
        enableTickets: guildData.enableTickets ?? false,
        enableAutomod: guildData.enableAutomod ?? false,
        enableMusic: guildData.enableMusic ?? false,
        enableJoinToCreate: guildData.enableJoinToCreate ?? false
      },
      config: {
        prefix: guildData.prefix || '!',
        modLogChannelId: guildData.modLogChannelId,
        levelUpChannelId: guildData.levelUpChannelId,
        quarantineRoleId: guildData.quarantineRoleId,
        geizhalsChannelId: guildData.geizhalsChannelId,
        welcomeChannelId: guildData.welcomeChannelId,
        joinToCreateChannelId: guildData.joinToCreateChannelId,
        joinToCreateCategoryId: guildData.joinToCreateCategoryId,
        welcomeMessage: guildData.welcomeMessage,
        leaveMessage: guildData.leaveMessage
      },
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

// Fallback function to gather guild data manually
async function getGuildDataFallback(guildId: string) {
  try {
    // Get basic guild settings
    const guild = await DatabaseService.getGuildSettings(guildId);
    
    // Get counts manually
    const [
      userLevels,
      warns,
      quarantineEntries,
      geizhalsTrackers,
      polls,
      giveaways,
      tickets,
      customCommands,
      levelRewards,
      automodRules
    ] = await Promise.all([
      DatabaseService.prisma.userLevel.findMany({
        where: { guildId },
        include: { user: true },
        take: 100
      }),
      DatabaseService.prisma.warn.findMany({
        where: { guildId, active: true },
        include: { user: true, moderator: true },
        take: 50
      }),
      DatabaseService.prisma.quarantineEntry.findMany({
        where: { guildId, active: true },
        include: { moderator: true, user: true }
      }),
      DatabaseService.prisma.geizhalsTracker.findMany({
        where: { guildId },
        include: { user: true },
        take: 50
      }),
      DatabaseService.prisma.poll.findMany({
        where: { guildId, active: true },
        include: { options: true }
      }),
      DatabaseService.prisma.giveaway.findMany({
        where: { guildId, active: true, ended: false },
        include: { entries: true }
      }),
      DatabaseService.prisma.ticket.findMany({
        where: { guildId, status: { not: 'CLOSED' } },
        include: { user: true, moderator: true }
      }),
      DatabaseService.prisma.customCommand.findMany({
        where: { guildId, enabled: true }
      }),
      DatabaseService.prisma.levelReward.findMany({
        where: { guildId }
      }),
      DatabaseService.prisma.automodRule.findMany({
        where: { guildId }
      })
    ]);

    return {
      ...guild,
      userLevels,
      warns,
      quarantineEntries,
      geizhalsTrackers,
      polls,
      giveaways,
      tickets,
      customCommands,
      levelRewards,
      automodRules
    };
  } catch (error) {
    console.error('Fallback data gathering failed:', error);
    throw error;
  }
}

// Create default guild data
async function createDefaultGuild(guildId: string) {
  try {
    const guild = await DatabaseService.prisma.guild.upsert({
      where: { id: guildId },
      update: {},
      create: {
        id: guildId,
        name: 'Unknown Guild',
        prefix: '!',
        enableLeveling: true,
        enableModeration: true,
        enableGeizhals: false,
        enablePolls: true,
        enableGiveaways: true,
        enableAutomod: false,
        enableTickets: false,
        enableMusic: false,
        enableJoinToCreate: false
      }
    });

    return {
      ...guild,
      userLevels: [],
      warns: [],
      quarantineEntries: [],
      geizhalsTrackers: [],
      polls: [],
      giveaways: [],
      tickets: [],
      customCommands: [],
      levelRewards: [],
      automodRules: []
    };
  } catch (error) {
    console.error('Failed to create default guild:', error);
    throw error;
  }
}

// Calculate stats from guild data
function calculateGuildStats(guildData: any, memberCount: number) {
  const totalUsers = guildData.userLevels?.length || 0;
  const totalWarns = guildData.warns?.filter((w: any) => w.active).length || 0;
  const activeQuarantine = guildData.quarantineEntries?.filter((q: any) => q.active).length || 0;
  const totalTrackers = guildData.geizhalsTrackers?.length || 0;
  const activePolls = guildData.polls?.filter((p: any) => p.active).length || 0;
  const activeGiveaways = guildData.giveaways?.filter((g: any) => g.active && !g.ended).length || 0;
  const openTickets = guildData.tickets?.filter((t: any) => t.status !== 'CLOSED').length || 0;
  const customCommands = guildData.customCommands?.filter((c: any) => c.enabled).length || 0;
  const levelRewards = guildData.levelRewards?.length || 0;
  const automodRules = guildData.automodRules?.filter((r: any) => r.enabled).length || 0;

  return {
    totalUsers,
    totalWarns,
    activeQuarantine,
    totalTrackers,
    activePolls,
    activeGiveaways,
    openTickets,
    customCommands,
    levelRewards,
    automodRules,
    levelingEnabled: guildData.enableLeveling ?? true,
    moderationEnabled: guildData.enableModeration ?? true,
    geizhalsEnabled: guildData.enableGeizhals ?? false,
    enablePolls: guildData.enablePolls ?? true,
    enableGiveaways: guildData.enableGiveaways ?? true,
    enableTickets: guildData.enableTickets ?? false,
    enableAutomod: guildData.enableAutomod ?? false,
    enableMusic: guildData.enableMusic ?? false,
    enableJoinToCreate: guildData.enableJoinToCreate ?? false,
    engagementRate: totalUsers > 0 && memberCount > 0 ? 
      Math.round((totalUsers / memberCount) * 100) : 0,
    moderationRate: totalWarns > 0 && totalUsers > 0 ? 
      Math.round((totalWarns / totalUsers) * 100) : 0
  };
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}