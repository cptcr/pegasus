// dashboard/pages/api/dashboard/levels/[guildId]/rewards/[rewardId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../../../../lib/auth';
import { DatabaseService } from '../../../../../../lib/database';

const ALLOWED_GUILD_ID = '554266392262737930';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { guildId, rewardId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  if (!rewardId || typeof rewardId !== 'string') {
    return res.status(400).json({ message: 'Reward ID is required' });
  }

  if (guildId !== ALLOWED_GUILD_ID) {
    return res.status(403).json({ message: 'Access denied to this guild' });
  }

  try {
    // First, get the reward to verify it belongs to the correct guild
    const reward = await DatabaseService.prisma.levelReward.findUnique({
      where: { id: parseInt(rewardId) }
    });

    if (!reward) {
      return res.status(404).json({ message: 'Level reward not found' });
    }

    if (reward.guildId !== guildId) {
      return res.status(403).json({ message: 'Access denied to this reward' });
    }

    // Delete the reward
    await DatabaseService.prisma.levelReward.delete({
      where: { id: parseInt(rewardId) }
    });

    res.status(200).json({ message: 'Level reward deleted successfully' });
  } catch (error) {
    console.error('Error deleting level reward:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}