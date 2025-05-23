// dashboard/pages/api/dashboard/activity.ts (Real-time Activity Data)
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
    // Get real activity data from the last 7 days
    const activityData = await DatabaseService.getRecentActivity(guildId, 7);
    
    // Get additional activity metrics
    const [
      todayActivity,
      weeklyTrends,
      monthlyComparison
    ] = await Promise.all([
      // Today's activity
      DatabaseService.getRecentActivity(guildId, 1),
      
      // Weekly trends (compare with previous week)
      Promise.all([
        DatabaseService.getRecentActivity(guildId, 7),
        DatabaseService.getRecentActivity(guildId, 14)
      ]).then(([thisWeek, lastTwoWeeks]) => {
        const lastWeek = {
          recentWarns: lastTwoWeeks.recentWarns - thisWeek.recentWarns,
          recentPolls: lastTwoWeeks.recentPolls - thisWeek.recentPolls,
          recentGiveaways: lastTwoWeeks.recentGiveaways - thisWeek.recentGiveaways,
          recentTickets: lastTwoWeeks.recentTickets - thisWeek.recentTickets,
        };
        
        return {
          thisWeek,
          lastWeek,
          trends: {
            warns: thisWeek.recentWarns - lastWeek.recentWarns,
            polls: thisWeek.recentPolls - lastWeek.recentPolls,
            giveaways: thisWeek.recentGiveaways - lastWeek.recentGiveaways,
            tickets: thisWeek.recentTickets - lastWeek.recentTickets,
          }
        };
      }),
      
      // Monthly comparison
      Promise.all([
        DatabaseService.getRecentActivity(guildId, 30),
        DatabaseService.getRecentActivity(guildId, 60)
      ]).then(([thisMonth, lastTwoMonths]) => {
        const lastMonth = {
          recentWarns: lastTwoMonths.recentWarns - thisMonth.recentWarns,
          recentPolls: lastTwoMonths.recentPolls - thisMonth.recentPolls,
          recentGiveaways: lastTwoMonths.recentGiveaways - thisMonth.recentGiveaways,
          recentTickets: lastTwoMonths.recentTickets - thisMonth.recentTickets,
        };
        
        return {
          thisMonth,
          lastMonth,
          growth: {
            warns: thisMonth.recentWarns - lastMonth.recentWarns,
            polls: thisMonth.recentPolls - lastMonth.recentPolls,
            giveaways: thisMonth.recentGiveaways - lastMonth.recentGiveaways,
            tickets: thisMonth.recentTickets - lastMonth.recentTickets,
          }
        };
      })
    ]);

    // Calculate activity scores and trends
    const activityScore = calculateActivityScore(activityData);
    const healthScore = calculateHealthScore(activityData, weeklyTrends.trends);

    const response = {
      // Basic activity data (last 7 days)
      ...activityData,
      
      // Today's activity
      today: todayActivity,
      
      // Trends and comparisons
      trends: weeklyTrends.trends,
      weeklyComparison: weeklyTrends,
      monthlyComparison: monthlyComparison,
      
      // Calculated metrics
      metrics: {
        activityScore,
        healthScore,
        totalEvents: activityData.recentWarns + activityData.recentPolls + 
                    activityData.recentGiveaways + activityData.recentTickets,
        averageDaily: {
          warns: Math.round(activityData.recentWarns / 7 * 10) / 10,
          polls: Math.round(activityData.recentPolls / 7 * 10) / 10,
          giveaways: Math.round(activityData.recentGiveaways / 7 * 10) / 10,
          tickets: Math.round(activityData.recentTickets / 7 * 10) / 10,
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