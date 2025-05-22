// dashboard/pages/api/dashboard/guild/[id].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseService } from '../../../lib/database';
import { discordService } from '../../../lib/discordService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  try {
    // Initialize Discord service if needed
    if (!discordService.isReady()) {
      await discordService.initialize();
    }

    // Get guild data from database
    const guildData = await DatabaseService.getGuildWithFullData(id);
    
    if (!guildData) {
      return res.status(404).json({ message: 'Guild not found' });
    }

    // Get additional data from Discord API
    const [discordGuild, memberCount] = await Promise.all([
      discordService.getGuildInfo(id),
      discordService.getGuildMemberCount(id)
    ]);

    // Update guild name if it changed on Discord
    if (discordGuild && discordGuild.name !== guildData.name) {
      await DatabaseService.updateGuildSettings(id, { name: discordGuild.name });
      guildData.name = discordGuild.name;
    }

    // Use Discord member count if available, otherwise fall back to database count
    const actualMemberCount = memberCount || guildData.memberCount;

    const response = {
      id: guildData.id,
      name: guildData.name,
      memberCount: actualMemberCount,
      iconURL: discordGuild?.iconURL || null,
      stats: guildData.stats,
      settings: guildData.settings
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching guild data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}