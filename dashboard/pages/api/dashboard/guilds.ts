import { NextApiRequest, NextApiResponse } from 'next';

// Mock data generator to replace the direct imports
const getMockGuildsData = () => {
  return [
    {
      id: '111222333',
      name: 'Test Server 1',
      memberCount: 156,
      stats: {
        totalUsers: 156,
        totalWarns: 3,
        activeQuarantine: 1,
        totalTrackers: 5,
        activePolls: 2,
        activeGiveaways: 1,
        openTickets: 4,
        customCommands: 8,
        levelingEnabled: true,
        moderationEnabled: true,
        geizhalsEnabled: true,
        enablePolls: true,
        enableGiveaways: true,
        enableTickets: true,
      }
    },
    {
      id: '444555666',
      name: 'Test Server 2',
      memberCount: 87,
      stats: {
        totalUsers: 87,
        totalWarns: 0,
        activeQuarantine: 0,
        totalTrackers: 2,
        activePolls: 1,
        activeGiveaways: 0,
        openTickets: 1,
        customCommands: 3,
        levelingEnabled: true,
        moderationEnabled: false,
        geizhalsEnabled: false,
        enablePolls: true,
        enableGiveaways: false,
        enableTickets: true,
      }
    }
  ];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Use mock data instead of accessing the bot client or database
    const guildsData = getMockGuildsData();
    res.status(200).json(guildsData);
  } catch (error) {
    console.error('Fehler beim Laden der Guilds:', error);
    res.status(500).json({ message: 'Fehler beim Laden der Guilds' });
  }
}