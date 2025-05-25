// dashboard/pages/api/dashboard/channels/[guildId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { discordService } from '../../../../lib/discordService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  try {
    // Initialize Discord service if needed
    if (!discordService.isReady()) {
      await discordService.initialize();
    }

    const channels = await discordService.getGuildChannels(guildId);

    res.status(200).json(channels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}