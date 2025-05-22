// dashboard/pages/api/dashboard/settings/[guildId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../lib/auth';
import { DatabaseService } from '../../../../lib/database';
import { discordService } from '../../../../lib/discordService';

const ALLOWED_GUILD_ID = '554266392262737930';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ error: 'Guild ID is required' });
  }

  // Only allow access to the specific guild
  if (guildId !== ALLOWED_GUILD_ID) {
    return res.status(403).json({ error: 'Access denied to this guild' });
  }

  if (req.method === 'GET') {
    try {
      // Initialize Discord service if needed
      if (!discordService.isReady()) {
        await discordService.initialize();
      }

      const guild = await DatabaseService.getGuildSettings(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      // Get Discord guild info to update name if needed
      try {
        const discordGuild = await discordService.getGuildInfo(guildId);
        if (discordGuild && discordGuild.name !== guild.name) {
          await DatabaseService.updateGuildSettings(guildId, { name: discordGuild.name });
          guild.name = discordGuild.name;
        }
      } catch (discordError) {
        console.warn('Discord API unavailable for guild name update');
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
          // Convert empty strings to null for optional fields
          if (key.endsWith('ChannelId') || key.endsWith('RoleId') || key.endsWith('CategoryId')) {
            obj[key] = updateData[key] === '' ? null : updateData[key];
          } else {
            obj[key] = updateData[key];
          }
          return obj;
        }, {} as any);

      const updatedGuild = await DatabaseService.updateGuildSettings(guildId, validatedData);

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

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}