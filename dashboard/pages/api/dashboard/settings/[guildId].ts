// dashboard/pages/api/dashboard/settings/[guildId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth'; // Use AuthenticatedRequest
import databaseEvents from '@/lib/database'; // Use the default export
import { GuildSettings } from '@/types/index'; // Use shared types

const ALLOWED_GUILD_ID = process.env.TARGET_GUILD_ID;


// The handler now correctly uses AuthenticatedRequest
async function settingsHandler(req: AuthenticatedRequest, res: NextApiResponse<GuildSettings | { error: string }>) {
  const { guildId } = req.query;

  if (typeof guildId !== 'string') {
    return res.status(400).json({ error: 'Invalid Guild ID.' });
  }

  // Ensure the dashboard can only modify settings for the TARGET_GUILD_ID
  if (guildId !== ALLOWED_GUILD_ID) {
      return res.status(403).json({ error: 'Access denied to configure this guild.' });
  }

  // Optional: Add permission check here to see if user can manage this guild.
  // This would typically involve checking req.user against roles/permissions for the guild.

  switch (req.method) {
    case 'GET':
      try {
        const settings = await databaseEvents.getGuildSettings(guildId);
        if (!settings) {
          // If no settings, provide default settings or an empty object based on frontend expectation
          const defaultSettings: GuildSettings = {
            // Populate with default values from your Config or common defaults
            prefix: '!',
            enableLeveling: true,
            // ... other default fields
          };
          return res.status(200).json(defaultSettings);
        }
        res.status(200).json(settings);
      } catch (error: unknown) { // Catch unknown
        console.error(`Failed to get settings for guild ${guildId}:`, error);
        res.status(500).json({ error: 'Internal Server Error.' });
      }
      break;

    case 'PUT': // Changed from POST to PUT for updating existing resource
      try {
        const settingsToUpdate = req.body as Partial<GuildSettings>;
        if (typeof settingsToUpdate !== 'object' || settingsToUpdate === null) {
          return res.status(400).json({ error: 'Invalid request body.' });
        }

        // Add more specific validation if needed (e.g., using Zod)
        // Example basic validation:
        if ('enableLeveling' in settingsToUpdate && typeof settingsToUpdate.enableLeveling !== 'boolean') {
           return res.status(400).json({ error: 'Invalid type for enableLeveling.' });
        }
        if ('prefix' in settingsToUpdate && typeof settingsToUpdate.prefix !== 'string' && settingsToUpdate.prefix !== null) {
            return res.status(400).json({ error: 'Invalid type for prefix.'});
        }
        // ... more validations

        const updatedGuild = await databaseEvents.updateGuildSettings(guildId, settingsToUpdate);
        // updateGuildSettings should return the updated Guild object, from which we extract settings
        if (updatedGuild && updatedGuild.settings) {
            res.status(200).json(updatedGuild.settings as GuildSettings);
        } else {
            throw new Error("Failed to retrieve updated settings after update.");
        }
      } catch (error: unknown) { // Catch unknown
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