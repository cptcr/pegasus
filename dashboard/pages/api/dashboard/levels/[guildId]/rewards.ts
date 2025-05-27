// dashboard/pages/api/dashboard/levels/[guildId]/rewards.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../../lib/auth';
import databaseEvents from '../../../../../lib/database';

interface LevelRewardRequest {
  level: number;
  roleId: string;
  description: string;
}

interface LevelRewardResponse {
  id: number;
  guildId: string;
  level: number;
  roleId: string;
  description: string | null;
  createdAt: string;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse<LevelRewardResponse | { message: string; error?: string }>) {
  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  if (req.method === 'POST') {
    try {
      const { level, roleId, description }: LevelRewardRequest = req.body;

      if (!level || !roleId || !description) {
        return res.status(400).json({ 
          message: 'Level, roleId, and description are required' 
        });
      }

      const reward = await databaseEvents.addLevelReward({
        guildId,
        level: Number(level),
        roleId,
        description
      });

      const response: LevelRewardResponse = {
        id: reward.id,
        guildId: reward.guildId,
        level: reward.level,
        roleId: reward.roleId,
        description: reward.description,
        createdAt: reward.createdAt.toISOString()
      };

      res.status(201).json(response);
    } catch (error: unknown) {
      console.error('Error creating level reward:', error);
      res.status(500).json({
        message: 'Failed to create level reward',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}