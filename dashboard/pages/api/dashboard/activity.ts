// dashboard/pages/api/dashboard/activity.ts - Fixed Activity API
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../lib/auth';
import { PrismaInstance as prisma } from '../../../lib/database';
import { RecentActivityData, ActivityMetrics } from '../../../types';

const ALLOWED_GUILD_ID = process.env.TARGET_GUILD_ID;

interface ActivityCounts {
  warns: number;
  polls: number;
  giveaways: number;
  tickets: number;
}

interface ActivityTrends {
  warns: number;
  polls: number;
  giveaways: number;
  tickets: number;
}

async function handler(
  req: AuthenticatedRequest, 
  res: NextApiResponse<RecentActivityData | { message: string; error?: string; timestamp?: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  if (guildId !== ALLOWED_GUILD_ID) {
    return res.status(403).json({ message: 'Access denied to this guild' });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      recentWarns, recentPolls, recentGiveaways, recentTickets,
      todayWarns, todayPolls, todayGiveaways, todayTickets,
      lastWeekWarns, lastWeekPolls, lastWeekGiveaways, lastWeekTickets
    ] = await Promise.all([
      // Last 7 days activity
      prisma.warn.count({ where: { guildId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.poll.count({ where: { guildId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.giveaway.count({ where: { guildId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.ticket.count({ where: { guildId, createdAt: { gte: sevenDaysAgo } } }),
      // Today's activity
      prisma.warn.count({ where: { guildId, createdAt: { gte: todayStart } } }),
      prisma.poll.count({ where: { guildId, createdAt: { gte: todayStart } } }),
      prisma.giveaway.count({ where: { guildId, createdAt: { gte: todayStart } } }),
      prisma.ticket.count({ where: { guildId, createdAt: { gte: todayStart } } }),
      // Previous week activity (for trends)
      prisma.warn.count({ where: { guildId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
      prisma.poll.count({ where: { guildId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
      prisma.giveaway.count({ where: { guildId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
      prisma.ticket.count({ where: { guildId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    ]);

    const currentWeekActivity: ActivityCounts = { 
      warns: recentWarns, 
      polls: recentPolls, 
      giveaways: recentGiveaways, 
      tickets: recentTickets 
    };
    
    const previousWeekActivity: ActivityCounts = { 
      warns: lastWeekWarns, 
      polls: lastWeekPolls, 
      giveaways: lastWeekGiveaways, 
      tickets: lastWeekTickets 
    };

    const trends: ActivityTrends = {
      warns: currentWeekActivity.warns - previousWeekActivity.warns,
      polls: currentWeekActivity.polls - previousWeekActivity.polls,
      giveaways: currentWeekActivity.giveaways - previousWeekActivity.giveaways,
      tickets: currentWeekActivity.tickets - previousWeekActivity.tickets,
    };

    const metrics: ActivityMetrics = {
      activityScore: calculateActivityScore(currentWeekActivity),
      healthScore: calculateHealthScore(currentWeekActivity, trends),
      totalEvents: currentWeekActivity.warns + currentWeekActivity.polls + currentWeekActivity.giveaways + currentWeekActivity.tickets,
      averageDaily: {
        warns: parseFloat((currentWeekActivity.warns / 7).toFixed(1)),
        polls: parseFloat((currentWeekActivity.polls / 7).toFixed(1)),
        giveaways: parseFloat((currentWeekActivity.giveaways / 7).toFixed(1)),
        tickets: parseFloat((currentWeekActivity.tickets / 7).toFixed(1)),
      }
    };

    const responseData: RecentActivityData = {
      recentWarns,
      recentPolls,
      recentGiveaways,
      recentTickets,
      today: {
        warns: todayWarns,
        polls: todayPolls,
        giveaways: todayGiveaways,
        tickets: todayTickets
      },
      trends,
      weeklyComparison: {
        thisWeek: currentWeekActivity,
        lastWeek: previousWeekActivity,
        trends
      },
      metrics,
      period: '7 days',
      lastUpdated: new Date().toISOString(),
      dataSource: 'live'
    };

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json(responseData);

  } catch (error: unknown) {
    console.error('Error loading activity data:', error);
    return res.status(500).json({
      message: 'Error loading activity data',
      error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

function calculateActivityScore(activity: ActivityCounts): number {
  const weights = { polls: 3, giveaways: 2, tickets: 1, warns: -1 };
  const score = (
    activity.polls * weights.polls +
    activity.giveaways * weights.giveaways +
    activity.tickets * weights.tickets +
    activity.warns * weights.warns
  );
  return Math.max(0, Math.min(100, 50 + score * 2));
}

function calculateHealthScore(activity: ActivityCounts, trends: ActivityTrends): number {
  let score = 75; // Base score
  if (activity.polls > 0) score += 5;
  if (activity.giveaways > 0) score += 5;
  if (trends.polls > 0) score += 5;
  if (trends.giveaways > 0) score += 5;
  if (activity.warns > 10) score -= 10;
  if (trends.warns > 5) score -= 5;
  if (activity.tickets > 20) score -= 5;
  if (activity.tickets > 0 && activity.tickets <= 10) score += 3;
  return Math.max(0, Math.min(100, score));
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}