// dashboard/pages/api/dashboard/levels/[guildId]/rewards.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../../lib/auth';
import { DatabaseService } from '../../../../../lib/database';

const ALLOWED_GUILD_ID = '554266392262737930';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  if (guildId !== ALLOWED_GUILD_ID) {
    return res.status(403).json({ message: 'Access denied to this guild' });
  }

  if (req.method === 'POST') {
    try {
      const { level, roleId, description } = req.body;

      if (!level || !roleId || !description) {
        return res.status(400).json({ message: 'Level, roleId, and description are required' });
      }

      if (typeof level !== 'number' || level < 1) {
        return res.status(400).json({ message: 'Level must be a positive number' });
      }

      const reward = await DatabaseService.addLevelReward({
        guildId,
        level,
        roleId,
        description
      });

      res.status(201).json(reward);
    } catch (error) {
      console.error('Error creating level reward:', error);
      
      // Handle unique constraint violation
      if ((error as any).code === 'P2002') {
        return res.status(409).json({ message: 'A reward for this level already exists' });
      }
      
      res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}