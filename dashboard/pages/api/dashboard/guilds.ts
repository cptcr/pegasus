import { NextApiRequest, NextApiResponse } from 'next';
import { client } from '../../../../src/index';
import { DatabaseService } from '../../../../src/lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Hole alle Guilds vom Bot
    const botGuilds = client.guilds.cache;
    const guildsData = [];

    for (const [guildId, guild] of botGuilds) {
      try {
        // Stats für jede Guild abrufen
        const stats = await DatabaseService.getGuildStats(guildId);
        const guildSettings = await DatabaseService.getGuildSettings(guildId);

        guildsData.push({
          id: guildId,
          name: guild.name,
          memberCount: guild.memberCount,
          stats: {
            ...stats,
            levelingEnabled: guildSettings.enableLeveling,
            moderationEnabled: guildSettings.enableModeration,
            geizhalsEnabled: guildSettings.enableGeizhals
          }
        });
      } catch (error) {
        console.error(`Fehler beim Laden der Stats für Guild ${guildId}:`, error);
        
        // Fallback mit Basis-Daten
        guildsData.push({
          id: guildId,
          name: guild.name,
          memberCount: guild.memberCount,
          stats: {
            totalUsers: 0,
            totalWarns: 0,
            activeQuarantine: 0,
            totalTrackers: 0,
            levelingEnabled: false,
            moderationEnabled: false,
            geizhalsEnabled: false
          }
        });
      }
    }

    res.status(200).json(guildsData);
  } catch (error) {
    console.error('Fehler beim Laden der Guilds:', error);
    res.status(500).json({ message: 'Fehler beim Laden der Guilds' });
  }
}