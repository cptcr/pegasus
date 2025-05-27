// dashboard/pages/api/dashboard/settings/[guildId].ts - Fixed Type Issues
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth';
import databaseEvents from '@/lib/database';
import { GuildSettings } from '@/types/index';

const ALLOWED_GUILD_ID = process.env.TARGET_GUILD_ID;

// Helper function to safely convert JsonValue to GuildSettings
function safeConvertToGuildSettings(jsonValue: unknown): GuildSettings | null {
  if (!jsonValue || typeof jsonValue !== 'object') {
    return null;
  }
  
  // Type assertion after validation
  return jsonValue as GuildSettings;
}

// Helper function to create default settings
function createDefaultSettings(): GuildSettings {
  return {
    prefix: '!',
    enableLeveling: true,
    enableModeration: true,
    enablePolls: true,
    enableGiveaways: true,
    enableTickets: false,
    enableGeizhals: false,
    enableAutomod: false,
    enableMusic: false,
    enableJoinToCreate: false,
    modLogChannelId: null,
    quarantineRoleId: null,
    staffRoleId: null,
    welcomeChannel: null,
    levelUpChannelId: null,
    geizhalsChannelId: null,
    joinToCreateChannelId: null,
    joinToCreateCategoryId: null,
    welcomeMessage: "Welcome {user} to {server}!",
    goodbyeMessage: "{user} has left the server.",
  };
}

async function settingsHandler(req: AuthenticatedRequest, res: NextApiResponse<GuildSettings | { error: string }>) {
  const { guildId } = req.query;

  if (typeof guildId !== 'string') {
    return res.status(400).json({ error: 'Invalid Guild ID.' });
  }

  // Ensure the dashboard can only modify settings for the TARGET_GUILD_ID
  if (guildId !== ALLOWED_GUILD_ID) {
      return res.status(403).json({ error: 'Access denied to configure this guild.' });
  }

  switch (req.method) {
    case 'GET':
      try {
        const guild = await databaseEvents.getGuild(guildId);
        if (!guild) {
          return res.status(404).json({ error: 'Guild not found.' });
        }
        
        const settings = safeConvertToGuildSettings(guild.settings);
        if (!settings) {
          // Return default settings if none exist
          const defaultSettings = createDefaultSettings();
          return res.status(200).json(defaultSettings);
        }
        
        res.status(200).json(settings);
      } catch (error: unknown) {
        console.error(`Failed to get settings for guild ${guildId}:`, error);
        res.status(500).json({ error: 'Internal Server Error.' });
      }
      break;

    case 'PUT':
      try {
        const settingsToUpdate = req.body as Partial<GuildSettings>;
        if (typeof settingsToUpdate !== 'object' || settingsToUpdate === null) {
          return res.status(400).json({ error: 'Invalid request body.' });
        }

        // Validate specific fields
        if ('enableLeveling' in settingsToUpdate && typeof settingsToUpdate.enableLeveling !== 'boolean') {
           return res.status(400).json({ error: 'Invalid type for enableLeveling.' });
        }
        if ('prefix' in settingsToUpdate && typeof settingsToUpdate.prefix !== 'string' && settingsToUpdate.prefix !== null) {
            return res.status(400).json({ error: 'Invalid type for prefix.'});
        }
        if ('modLogChannelId' in settingsToUpdate && typeof settingsToUpdate.modLogChannelId !== 'string' && settingsToUpdate.modLogChannelId !== null) {
            return res.status(400).json({ error: 'Invalid type for modLogChannelId.'});
        }

        const updatedGuild = await databaseEvents.updateGuildSettings(guildId, settingsToUpdate);
        
        if (updatedGuild && updatedGuild.settings) {
            const updatedSettings = safeConvertToGuildSettings(updatedGuild.settings);
            if (updatedSettings) {
              res.status(200).json(updatedSettings);
            } else {
              throw new Error("Failed to convert updated settings.");
            }
        } else {
            throw new Error("Failed to retrieve updated settings after update.");
        }
      } catch (error: unknown) {
         console.error(`Failed to update settings for guild ${guildId}:`, error);
         res.status(500).json({ error: 'Internal Server Error.' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Wrap the handler with requireAuth
export default function protectedSettingsHandler(req: NextApiRequest, res: NextApiResponse) {
    return requireAuth(req as AuthenticatedRequest, res, settingsHandler);
}