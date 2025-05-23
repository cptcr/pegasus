// dashboard/pages/api/dashboard/levels/[guildId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../lib/auth';
import { DatabaseService } from '../../../../lib/database';

const ALLOWED_GUILD_ID = '554266392262737930';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { guildId, page = '1', limit = '20' } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  if (guildId !== ALLOWED_GUILD_ID) {
    return res.status(403).json({ message: 'Access denied to this guild' });
  }

  try {
    const pageNumber = Math.max(1, parseInt(page as string));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit as string)));

    const levelData = await DatabaseService.getLevelData(guildId, pageNumber, limitNumber);
    res.status(200).json(levelData);
  } catch (error) {
    console.error('Error fetching level data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}