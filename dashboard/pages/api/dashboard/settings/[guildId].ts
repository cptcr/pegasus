// dashboard/pages/api/dashboard/settings/[guildId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedApiRequest } from '@/lib/auth';
import db from '@/lib/database';
import { GuildSettings } from '@/types/index'; // Use shared types

export default requireAuth(async (req: AuthenticatedApiRequest, res: NextApiResponse) => {
  const { guildId } = req.query;

  if (typeof guildId !== 'string') {
    return res.status(400).json({ error: 'Invalid Guild ID.' });
  }

  // Optional: Add permission check here to see if user can manage this guild.

  switch (req.method) {
    case 'GET':
      try {
        const settings = await db.getGuildSettings(guildId);
        if (!settings) {
          return res.status(404).json({ error: 'Settings not found for this guild.' });
        }
        res.status(200).json(settings);
      } catch (error) {
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
        
        // Basic validation - can be expanded with Zod for more complex rules
        if ('enableLeveling' in settingsToUpdate && typeof settingsToUpdate.enableLeveling !== 'boolean') {
           return res.status(400).json({ error: 'Invalid type for enableLeveling.' });
        }
        
        const updatedGuild = await db.updateGuildSettings(guildId, settingsToUpdate);
        res.status(200).json(updatedGuild.settings);
      } catch (error) {
         console.error(`Failed to update settings for guild ${guildId}:`, error);
         res.status(500).json({ error: 'Internal Server Error.' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
});