// dashboard/pages/api/dashboard/activity.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, AuthenticatedRequest } from '../../../lib/auth';
import { DatabaseService } from '../../../lib/database';

const ALLOWED_GUILD_ID = '554266392262737930';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { guildId } = req.query;

  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ message: 'Guild ID is required' });
  }

  // Only allow access to the specific guild
  if (guildId !== ALLOWED_GUILD_ID) {
    return res.status(403).json({ message: 'Access denied to this guild' });
  }

  try {
    // Get recent activity data from database
    const [
      recentWarns,
      recentPolls,
      recentGiveaways,
      recentTickets,
      todayWarns,
      todayPolls,
      todayGiveaways,
      todayTickets
    ] = await Promise.all([
      // Last 7 days activity
      DatabaseService.prisma.warn.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      DatabaseService.prisma.poll.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      DatabaseService.prisma.giveaway.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      DatabaseService.prisma.ticket.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      // Today's activity
      DatabaseService.prisma.warn.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      DatabaseService.prisma.poll.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      DatabaseService.prisma.giveaway.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      DatabaseService.prisma.ticket.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    // Get weekly trends (compare with previous week)
    const [
      lastWeekWarns,
      lastWeekPolls,
      lastWeekGiveaways,
      lastWeekTickets
    ] = await Promise.all([
      DatabaseService.prisma.warn.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      DatabaseService.prisma.poll.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      DatabaseService.prisma.giveaway.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      DatabaseService.prisma.ticket.count({
        where: {
          guildId,
          createdAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // Calculate trends
    const trends = {
      warns: recentWarns - lastWeekWarns,
      polls: recentPolls - lastWeekPolls,
      giveaways: recentGiveaways - lastWeekGiveaways,
      tickets: recentTickets - lastWeekTickets,
    };

    // Calculate activity score based on various factors
    const activityScore = calculateActivityScore({
      recentPolls,
      recentGiveaways,
      recentTickets,
      recentWarns
    });

    // Calculate health score
    const healthScore = calculateHealthScore({
      recentPolls,
      recentGiveaways,
      recentTickets,
      recentWarns
    }, trends);

    const response = {
      // Basic activity data (last 7 days)
      recentWarns,
      recentPolls,
      recentGiveaways,
      recentTickets,
      
      // Today's activity
      today: {
        recentWarns: todayWarns,
        recentPolls: todayPolls,
        recentGiveaways: todayGiveaways,
        recentTickets: todayTickets
      },
      
      // Trends and comparisons
      trends,
      weeklyComparison: {
        thisWeek: { recentWarns, recentPolls, recentGiveaways, recentTickets },
        lastWeek: { recentWarns: lastWeekWarns, recentPolls: lastWeekPolls, recentGiveaways: lastWeekGiveaways, recentTickets: lastWeekTickets },
        trends
      },
      
      // Calculated metrics
      metrics: {
        activityScore,
        healthScore,
        totalEvents: recentWarns + recentPolls + recentGiveaways + recentTickets,
        averageDaily: {
          warns: Math.round(recentWarns / 7 * 10) / 10,
          polls: Math.round(recentPolls / 7 * 10) / 10,
          giveaways: Math.round(recentGiveaways / 7 * 10) / 10,
          tickets: Math.round(recentTickets / 7 * 10) / 10,
        }
      },
      
      // Metadata
      period: '7 days',
      lastUpdated: new Date().toISOString(),
      dataSource: 'live'
    };

    // Set cache headers for real-time updates
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    
    res.status(200).json(response);

  } catch (error) {
    console.error('Error loading activity data:', error);
    res.status(500).json({ 
      message: 'Error loading activity data',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

function calculateActivityScore(activity: any): number {
  // Calculate activity score based on various factors
  const weights = {
    polls: 3,      // Positive activity
    giveaways: 2,  // Positive activity
    tickets: 1,    // Neutral (user engagement)
    warns: -1      // Negative activity
  };
  
  const score = (
    activity.recentPolls * weights.polls +
    activity.recentGiveaways * weights.giveaways +
    activity.recentTickets * weights.tickets +
    activity.recentWarns * weights.warns
  );
  
  // Normalize to 0-100 scale
  return Math.max(0, Math.min(100, 50 + score * 2));
}

function calculateHealthScore(activity: any, trends: any): number {
  // Calculate server health based on activity and trends
  let score = 75; // Base score
  
  // Positive indicators
  if (activity.recentPolls > 0) score += 5;
  if (activity.recentGiveaways > 0) score += 5;
  if (trends.polls > 0) score += 5;
  if (trends.giveaways > 0) score += 5;
  
  // Negative indicators
  if (activity.recentWarns > 10) score -= 10;
  if (trends.warns > 5) score -= 5;
  if (activity.recentTickets > 20) score -= 5;
  
  // Neutral indicators (engagement)
  if (activity.recentTickets > 0 && activity.recentTickets <= 10) score += 3;
  
  return Math.max(0, Math.min(100, score));
}

export default function protectedHandler(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req as AuthenticatedRequest, res, handler);
}