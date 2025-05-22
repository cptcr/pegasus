// dashboard/pages/api/dashboard/guild/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  try {
    // Get guild data with all related stats
    const guild = await prisma.guild.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            warns: { where: { active: true } },
            userLevels: true,
            quarantineEntries: { where: { active: true } },
            geizhalsTrackers: true,
            polls: { where: { active: true } },
            giveaways: { where: { active: true, ended: false } },
            tickets: { where: { status: { not: 'CLOSED' } } },
            customCommands: { where: { enabled: true } }
          }
        }
      }
    });

    if (!guild) {
      return res.status(404).json({ message: 'Guild not found' });
    }

    // For member count, we'd need to fetch from Discord API in a real implementation
    // For now, we'll use the user levels count as an approximation
    const memberCount = guild._count.userLevels;

    const response = {
      id: guild.id,
      name: guild.name,
      memberCount,
      stats: {
        totalUsers: guild._count.userLevels,
        totalWarns: guild._count.warns,
        activeQuarantine: guild._count.quarantineEntries,
        totalTrackers: guild._count.geizhalsTrackers,
        activePolls: guild._count.polls,
        activeGiveaways: guild._count.giveaways,
        openTickets: guild._count.tickets,
        customCommands: guild._count.customCommands
      },
      settings: {
        enableLeveling: guild.enableLeveling,
        enableModeration: guild.enableModeration,
        enableGeizhals: guild.enableGeizhals,
        enablePolls: guild.enablePolls,
        enableGiveaways: guild.enableGiveaways,
        enableTickets: guild.enableTickets,
        enableAutomod: guild.enableAutomod,
        enableMusic: guild.enableMusic,
        enableJoinToCreate: guild.enableJoinToCreate
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching guild data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// dashboard/pages/api/dashboard/guilds.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const guilds = await prisma.guild.findMany({
      include: {
        _count: {
          select: {
            warns: { where: { active: true } },
            userLevels: true,
            quarantineEntries: { where: { active: true } },
            geizhalsTrackers: true,
            polls: { where: { active: true } },
            giveaways: { where: { active: true, ended: false } },
            tickets: { where: { status: { not: 'CLOSED' } } },
            customCommands: { where: { enabled: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const guildsData = guilds.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild._count.userLevels, // Approximation
      stats: {
        totalUsers: guild._count.userLevels,
        totalWarns: guild._count.warns,
        activeQuarantine: guild._count.quarantineEntries,
        totalTrackers: guild._count.geizhalsTrackers,
        activePolls: guild._count.polls,
        activeGiveaways: guild._count.giveaways,
        openTickets: guild._count.tickets,
        customCommands: guild._count.customCommands,
        levelingEnabled: guild.enableLeveling,
        moderationEnabled: guild.enableModeration,
        geizhalsEnabled: guild.enableGeizhals,
        enablePolls: guild.enablePolls,
        enableGiveaways: guild.enableGiveaways,
        enableTickets: guild.enableTickets
      }
    }));

    res.status(200).json(guildsData);
  } catch (error) {
    console.error('Error fetching guilds:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// dashboard/pages/api/dashboard/activity.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [recentWarns, recentPolls, recentGiveaways, recentTickets] = await Promise.all([
      prisma.warn.count({
        where: {
          guildId,
          createdAt: { gte: oneWeekAgo }
        }
      }),
      prisma.poll.count({
        where: {
          guildId,
          createdAt: { gte: oneWeekAgo }
        }
      }),
      prisma.giveaway.count({
        where: {
          guildId,
          createdAt: { gte: oneWeekAgo }
        }
      }),
      prisma.ticket.count({
        where: {
          guildId,
          createdAt: { gte: oneWeekAgo }
        }
      })
    ]);

    res.status(200).json({
      recentWarns,
      recentPolls,
      recentGiveaways,
      recentTickets
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// dashboard/pages/api/dashboard/settings/[guildId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ error: 'Guild ID is required' });
  }

  if (req.method === 'GET') {
    try {
      const guild = await prisma.guild.findUnique({
        where: { id: guildId }
      });

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      res.status(200).json(guild);
    } catch (error) {
      console.error('Error fetching guild settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const updateData = req.body;
      
      // Validate the data
      const allowedFields = [
        'name', 'prefix', 'modLogChannelId', 'levelUpChannelId', 'quarantineRoleId',
        'geizhalsChannelId', 'welcomeChannelId', 'joinToCreateChannelId', 'joinToCreateCategoryId',
        'enableLeveling', 'enableModeration', 'enableGeizhals', 'enablePolls', 'enableGiveaways',
        'enableAutomod', 'enableTickets', 'enableMusic', 'enableJoinToCreate',
        'welcomeMessage', 'leaveMessage'
      ];

      const validatedData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {} as any);

      const updatedGuild = await prisma.guild.update({
        where: { id: guildId },
        data: validatedData
      });

      res.status(200).json(updatedGuild);
    } catch (error) {
      console.error('Error updating guild settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// dashboard/pages/api/dashboard/moderation/[guildId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  try {
    const [warnings, quarantineEntries, automodRules] = await Promise.all([
      prisma.warn.findMany({
        where: { guildId, active: true },
        include: {
          user: true,
          moderator: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.quarantineEntry.findMany({
        where: { guildId, active: true },
        include: {
          moderator: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.automodRule.findMany({
        where: { guildId },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    res.status(200).json({
      warnings,
      quarantineEntries,
      automodRules
    });
  } catch (error) {
    console.error('Error fetching moderation data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
