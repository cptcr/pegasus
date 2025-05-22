// dashboard/pages/api/dashboard/levels/[guildId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { guildId } = req.query;
  const { page = '1', limit = '20' } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  try {
    const pageNumber = Math.max(1, parseInt(page as string));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNumber - 1) * limitNumber;

    const [leaderboard, total, levelRewards] = await Promise.all([
      prisma.userLevel.findMany({
        where: { guildId },
        include: {
          user: true
        },
        orderBy: [
          { level: 'desc' },
          { xp: 'desc' }
        ],
        skip,
        take: limitNumber
      }),
      prisma.userLevel.count({
        where: { guildId }
      }),
      prisma.levelReward.findMany({
        where: { guildId },
        orderBy: { level: 'asc' }
      })
    ]);

    res.status(200).json({
      leaderboard: leaderboard.map((entry, index) => ({
        ...entry,
        rank: skip + index + 1
      })),
      total,
      currentPage: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      levelRewards
    });
  } catch (error) {
    console.error('Error fetching level data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}