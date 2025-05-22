import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get the guildId from the query
  const { guildId } = req.query;

  if (!guildId) {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  try {
    // Generate mock activity data based on guildId
    // For simplicity, we'll use the same data for all guilds in this demo
    const activityData = {
      recentWarns: Math.floor(Math.random() * 5),
      recentPolls: Math.floor(Math.random() * 3),
      recentGiveaways: Math.floor(Math.random() * 2),
      recentTickets: Math.floor(Math.random() * 6)
    };

    res.status(200).json(activityData);
  } catch (error) {
    console.error('Fehler beim Laden der Aktivitäten:', error);
    res.status(500).json({ message: 'Fehler beim Laden der Aktivitäten' });
  }
} 