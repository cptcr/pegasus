// dashboard/pages/dashboard/[guildId]/index.tsx
import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  ChartBarIcon, 
  UsersIcon, 
  ExclamationTriangleIcon, 
  ShieldCheckIcon,
  CogIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  TicketIcon,
  CommandLineIcon,
  ArrowPathIcon,
  EyeIcon,
  ClockIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const TARGET_GUILD_ID = '554266392262737930';

interface GuildStats {
  totalUsers: number;
  totalWarns: number;
  activeQuarantine: number;
  totalTrackers: number;
  activePolls: number;
  activeGiveaways: number;
  openTickets: number;
  customCommands: number;
  levelRewards: number;
  automodRules: number;
  levelingEnabled: boolean;
  moderationEnabled: boolean;
  geizhalsEnabled: boolean;
  enablePolls: boolean;
  enableGiveaways: boolean;
  enableTickets: boolean;
  enableAutomod: boolean;
  enableMusic: boolean;
  enableJoinToCreate: boolean;
  engagementRate: number;
  moderationRate: number;
  lastUpdated: string;
}

interface Guild {
  id: string;
  name: string;
  memberCount: number;
  iconURL?: string;
  stats: GuildStats;
  status: {
    botOnline: boolean;
    databaseConnected: boolean;
    lastSync: string;
  };
}

interface RecentActivity {
  recentWarns: number;
  recentPolls: number;
  recentGiveaways: number;
  recentTickets: number;
  today: {
    recentWarns: number;
    recentPolls: number;
    recentGiveaways: number;
    recentTickets: number;
  };
  metrics: {
    activityScore: number;
    healthScore: number;
    totalEvents: number;
    averageDaily: {
      warns: number;
      polls: number;
      giveaways: number;
      tickets: number;
    };
  };
}

export default function GuildDashboard() {
  const router = useRouter();
  const { guildId } = router.query;
  const [guild, setGuild] = useState<Guild | null>(null);
  const [activity, setActivity] = useState<RecentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (guildId && typeof guildId === 'string') {
      fetchDashboardData();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        fetchDashboardData(true);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [guildId]);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      setError(null);
      
      const [guildResponse, activityResponse] = await Promise.all([
        fetch(`/api/dashboard/guild/${guildId}`),
        fetch(`/api/dashboard/activity?guildId=${guildId}`)
      ]);
      
      if (!guildResponse.ok) {
        throw new Error(`Failed to fetch guild data: ${guildResponse.status}`);
      }
      
      const guildData = await guildResponse.json();
      setGuild(guildData);

      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        setActivity(activityData);
      }

      setLastUpdate(new Date());
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto border-b-2 border-indigo-400 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-300">Loading dashboard...</p>
          <p className="text-sm text-gray-500">Fetching real-time data from database...</p>
        </div>
      </div>
    );
  }

  if (error || !guild) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 p-3 mx-auto mb-4 border rounded-full bg-red-900/20 border-red-500/20">
            <ExclamationTriangleIcon className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-red-400">Error Loading Dashboard</h1>
          <p className="mb-4 text-gray-400">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => fetchDashboardData()}
              className="px-4 py-2 mr-2 text-white transition-colors bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-white transition-colors bg-gray-600 rounded-md hover:bg-gray-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Head>
        <title>Pegasus Bot Dashboard - {guild.name}</title>
        <meta name="description" content="Admin Dashboard for Hinko Discord Bot" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 shadow-lg">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                {guild.iconURL ? (
                  <img src={guild.iconURL} alt="Guild Icon" className="w-8 h-8 rounded-full" />
                ) : (
                  <ShieldCheckIcon className="w-8 h-8 text-indigo-400" />
                )}
                <div>
                  <h1 className="text-2xl font-bold text-white">Pegasus Dashboard</h1>
                  <p className="text-sm text-gray-400">{guild.name}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Status Indicators */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  guild.status.botOnline ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
                <span className="text-xs text-gray-400">
                  Bot {guild.status.botOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  guild.status.databaseConnected ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
                <span className="text-xs text-gray-400">
                  DB {guild.status.databaseConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {lastUpdate && (
                <div className="text-sm text-gray-400">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </div>
              )}
              <span className="text-sm text-gray-400">
                v2.0.0 • {guild.memberCount.toLocaleString()} members
              </span>
              <button 
                onClick={() => fetchDashboardData()}
                disabled={refreshing}
                className="flex items-center px-4 py-2 space-x-1 text-white transition-colors bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
        
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <QuickActionCard
              title="Settings"
              icon={<CogIcon className="w-6 h-6" />}
              href={`/dashboard/${guild.id}/settings`}
              color="blue"
            />
            <QuickActionCard
              title="Moderation"
              icon={<ShieldCheckIcon className="w-6 h-6" />}
              href={`/dashboard/${guild.id}/moderation`}
              color="red"
            />
            <QuickActionCard
              title="Levels"
              icon={<ChartBarIcon className="w-6 h-6" />}
              href={`/dashboard/${guild.id}/levels`}
              color="green"
            />
            <QuickActionCard
              title="Polls"
              icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}
              href={`#`}
              color="purple"
              disabled={!guild.stats.enablePolls}
            />
            <QuickActionCard
              title="Giveaways"
              icon={<GiftIcon className="w-6 h-6" />}
              href={`#`}
              color="yellow"
              disabled={!guild.stats.enableGiveaways}
            />
            <QuickActionCard
              title="Tickets"
              icon={<TicketIcon className="w-6 h-6" />}
              href={`#`}
              color="indigo"
              disabled={!guild.stats.enableTickets}
            />
          </div>
        </div>

        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-white">Server Overview</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Users"
              value={guild.stats.totalUsers}
              icon={<UsersIcon className="w-6 h-6" />}
              color="indigo"
              trend="up"
              description="Users with XP tracked"
              change={`${guild.stats.engagementRate}% of members`}
            />
            <StatsCard
              title="Active Warnings"
              value={guild.stats.totalWarns}
              icon={<ExclamationTriangleIcon className="w-6 h-6" />}
              color="red"
              change={activity?.today.recentWarns ? `+${activity.today.recentWarns} today` : undefined}
              description="Unresolved user warnings"
            />
            <StatsCard
              title="Open Tickets"
              value={guild.stats.openTickets}
              icon={<TicketIcon className="w-6 h-6" />}
              color="purple"
              change={activity?.today.recentTickets ? `+${activity.today.recentTickets} today` : undefined}
              description="Support tickets awaiting response"
            />
            <StatsCard
              title="Custom Commands"
              value={guild.stats.customCommands}
              icon={<CommandLineIcon className="w-6 h-6" />}
              color="gray"
              description="Enabled custom commands"
            />
          </div>
        </div>

        {/* Community Features Stats */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-white">Community Activity</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Active Polls"
              value={guild.stats.activePolls}
              icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}
              color="blue"
              change={activity?.today.recentPolls ? `+${activity.today.recentPolls} today` : undefined}
              description="Running community polls"
              disabled={!guild.stats.enablePolls}
            />
            <StatsCard
              title="Active Giveaways"
              value={guild.stats.activeGiveaways}
              icon={<GiftIcon className="w-6 h-6" />}
              color="green"
              change={activity?.today.recentGiveaways ? `+${activity.today.recentGiveaways} today` : undefined}
              description="Ongoing giveaways"
              disabled={!guild.stats.enableGiveaways}
            />
            <StatsCard
              title="Price Trackers"
              value={guild.stats.totalTrackers}
              icon={<BellIcon className="w-6 h-6" />}
              color="orange"
              description="Geizhals price trackers"
              disabled={!guild.stats.geizhalsEnabled}
            />
            <StatsCard
              title="Quarantined"
              value={guild.stats.activeQuarantine}
              icon={<ShieldCheckIcon className="w-6 h-6" />}
              color="yellow"
              description="Users in quarantine"
            />
          </div>
        </div>

        {/* Activity Metrics */}
        {activity && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-white">Activity Metrics</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">Activity Score</h3>
                    <p className="text-sm text-gray-400">Overall server activity</p>
                  </div>
                  <div className="text-3xl font-bold text-indigo-400">
                    {Math.round(activity.metrics.activityScore)}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 transition-all duration-300 bg-indigo-600 rounded-full"
                      style={{ width: `${activity.metrics.activityScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">Health Score</h3>
                    <p className="text-sm text-gray-400">Server health status</p>
                  </div>
                  <div className="text-3xl font-bold text-green-400">
                    {Math.round(activity.metrics.healthScore)}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full h-2 bg-gray-700 rounded-full">
                    <div 
                      className="h-2 transition-all duration-300 bg-green-600 rounded-full"
                      style={{ width: `${activity.metrics.healthScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">Weekly Events</h3>
                    <p className="text-sm text-gray-400">Total events this week</p>
                  </div>
                  <div className="text-3xl font-bold text-purple-400">
                    {activity.metrics.totalEvents}
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>Daily avg:</span>
                    <span>{Math.round(activity.metrics.totalEvents / 7 * 10) / 10}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Status */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-white">Feature Status</h2>
          <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FeatureStatus
                name="Level System"
                enabled={guild.stats.levelingEnabled}
                icon={<ChartBarIcon className="w-5 h-5" />}
                description="XP and ranking system"
                stats={`${guild.stats.totalUsers} users tracked`}
              />
              <FeatureStatus
                name="Moderation"
                enabled={guild.stats.moderationEnabled}
                icon={<ShieldCheckIcon className="w-5 h-5" />}
                description="Warning and quarantine system"
                stats={`${guild.stats.automodRules} automod rules`}
              />
              <FeatureStatus
                name="Geizhals Tracker"
                enabled={guild.stats.geizhalsEnabled}
                icon={<BellIcon className="w-5 h-5" />}
                description="Price tracking for hardware"
                stats={`${guild.stats.totalTrackers} active trackers`}
              />
              <FeatureStatus
                name="Polls"
                enabled={guild.stats.enablePolls}
                icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
                description="Community voting system"
                stats={`${guild.stats.activePolls} active polls`}
              />
              <FeatureStatus
                name="Giveaways"
                enabled={guild.stats.enableGiveaways}
                icon={<GiftIcon className="w-5 h-5" />}
                description="Contest and prize system"
                stats={`${guild.stats.activeGiveaways} running`}
              />
              <FeatureStatus
                name="Tickets"
                enabled={guild.stats.enableTickets}
                icon={<TicketIcon className="w-5 h-5" />}
                description="Support ticket system"
                stats={`${guild.stats.openTickets} open tickets`}
              />
            </div>
          </div>
        </div>

        {/* Recent Activity Summary */}
        {activity && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-white">Recent Activity (Last 7 Days)</h2>
            <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <ActivitySummary
                  title="New Warnings"
                  count={activity.recentWarns}
                  dailyAvg={activity.metrics.averageDaily.warns}
                  color="red"
                  icon={<ExclamationTriangleIcon className="w-5 h-5" />}
                />
                <ActivitySummary
                  title="New Polls"
                  count={activity.recentPolls}
                  dailyAvg={activity.metrics.averageDaily.polls}
                  color="blue"
                  icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
                />
                <ActivitySummary
                  title="New Giveaways"
                  count={activity.recentGiveaways}
                  dailyAvg={activity.metrics.averageDaily.giveaways}
                  color="green"
                  icon={<GiftIcon className="w-5 h-5" />}
                />
                <ActivitySummary
                  title="New Tickets"
                  count={activity.recentTickets}
                  dailyAvg={activity.metrics.averageDaily.tickets}
                  color="purple"
                  icon={<TicketIcon className="w-5 h-5" />}
                />
              </div>
            </div>
          </div>
        )}

        {/* Management Links */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-white">Management</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ManagementCard
              title="Server Settings"
              description="Configure bot features and channels"
              href={`/dashboard/${guild.id}/settings`}
              icon={<CogIcon className="w-8 h-8" />}
              features={["Feature toggles", "Channel config", "Role settings"]}
            />
            <ManagementCard
              title="View Moderation"
              description="Review warnings, quarantine, and automod rules"
              href={`/dashboard/${guild.id}/moderation`}
              icon={<EyeIcon className="w-8 h-8" />}
              features={["Active warnings", "Quarantine entries", "Automod rules"]}
            />
            <ManagementCard
              title="Level System"
              description="Manage leaderboards and level rewards"
              href={`/dashboard/${guild.id}/levels`}
              icon={<ChartBarIcon className="w-8 h-8" />}
              features={["User leaderboard", "Level rewards", "XP tracking"]}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'indigo' | 'red' | 'yellow' | 'purple' | 'blue' | 'green' | 'gray' | 'orange';
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  disabled?: boolean;
}

function StatsCard({ title, value, icon, color, change, trend, description, disabled }: StatsCardProps) {
  const colorClasses = {
    indigo: 'bg-indigo-900/20 text-indigo-400 border-indigo-500/20',
    red: 'bg-red-900/20 text-red-400 border-red-500/20',
    yellow: 'bg-yellow-900/20 text-yellow-400 border-yellow-500/20',
    purple: 'bg-purple-900/20 text-purple-400 border-purple-500/20',
    blue: 'bg-blue-900/20 text-blue-400 border-blue-500/20',
    green: 'bg-green-900/20 text-green-400 border-green-500/20',
    gray: 'bg-gray-700/20 text-gray-400 border-gray-500/20',
    orange: 'bg-orange-900/20 text-orange-400 border-orange-500/20',
  };

  return (
    <div className={`p-6 transition-colors bg-gray-800 border border-gray-700 rounded-lg shadow-lg hover:border-gray-600 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center">
        <div className={`p-3 rounded-full border ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="flex-1 ml-4">
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <div className="flex items-center space-x-2">
            <p className="text-2xl font-semibold text-white">{value.toLocaleString()}</p>
            {trend && (
              <ClockIcon
                className={`h-4 w-4 ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400 rotate-180' : 'text-gray-400'}`} 
              />
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          )}
          {change && (
            <p className="mt-1 text-xs text-gray-400">{change}</p>
          )}
          {disabled && (
            <p className="mt-1 text-xs text-orange-400">Feature disabled</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  icon: React.ReactNode;
  href: string;
  color: 'blue' | 'red' | 'green' | 'purple' | 'yellow' | 'indigo';
  disabled?: boolean;
}

function QuickActionCard({ title, icon, href, color, disabled }: QuickActionCardProps) {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700 border-blue-500',
    red: 'bg-red-600 hover:bg-red-700 border-red-500',
    green: 'bg-green-600 hover:bg-green-700 border-green-500',
    purple: 'bg-purple-600 hover:bg-purple-700 border-purple-500',
    yellow: 'bg-yellow-600 hover:bg-yellow-700 border-yellow-500',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500',
  };

  if (disabled) {
    return (
      <div className={`bg-gray-700 text-gray-400 p-4 rounded-lg shadow-lg border border-gray-600 opacity-50 flex flex-col items-center text-center cursor-not-allowed`}>
        {icon}
        <span className="mt-2 text-sm font-medium">{title}</span>
        <span className="text-xs text-gray-500">Disabled</span>
      </div>
    );
  }

  return (
    <Link 
      href={href}
      className={`${colorClasses[color]} text-white p-4 rounded-lg shadow-lg transition-all duration-200 flex flex-col items-center text-center border hover:scale-105 hover:shadow-xl`}
    >
      {icon}
      <span className="mt-2 text-sm font-medium">{title}</span>
    </Link>
  );
}

interface FeatureStatusProps {
  name: string;
  enabled: boolean;
  icon: React.ReactNode;
  description: string;
  stats?: string;
}

function FeatureStatus({ name, enabled, icon, description, stats }: FeatureStatusProps) {
  return (
    <div className="flex items-start p-4 space-x-3 transition-colors border border-gray-700 rounded-lg hover:border-gray-600">
      <div className={`p-2 rounded-md border ${enabled ? 'bg-green-900/20 text-green-400 border-green-500/20' : 'bg-gray-700/20 text-gray-500 border-gray-600/20'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-medium text-white truncate">{name}</h4>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            enabled ? 'bg-green-900/20 text-green-400 border border-green-500/20' : 'bg-gray-700/20 text-gray-500 border border-gray-600/20'
          }`}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-400">{description}</p>
        {stats && (
          <p className="mt-1 text-xs text-gray-500">{stats}</p>
        )}
      </div>
    </div>
  );
}

interface ActivitySummaryProps {
  title: string;
  count: number;
  dailyAvg: number;
  color: 'red' | 'blue' | 'green' | 'purple';
  icon: React.ReactNode;
}

function ActivitySummary({ title, count, dailyAvg, color, icon }: ActivitySummaryProps) {
  const colorClasses = {
    red: 'text-red-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
  };

  const bgColorClasses = {
    red: 'bg-red-900/20',
    blue: 'bg-blue-900/20',
    green: 'bg-green-900/20',
    purple: 'bg-purple-900/20',
  };

  return (
    <div className="text-center">
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${bgColorClasses[color]} mb-3`}>
        <div className={colorClasses[color]}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>
        {count.toLocaleString()}
      </div>
      <div className="text-sm text-gray-400">{title}</div>
      <div className="text-xs text-gray-500">
        {dailyAvg.toFixed(1)}/day avg
      </div>
    </div>
  );
}

interface ManagementCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  features?: string[];
}

function ManagementCard({ title, description, href, icon, features }: ManagementCardProps) {
  return (
    <Link 
      href={href}
      className="block p-6 transition-all duration-200 bg-gray-800 border border-gray-700 rounded-lg shadow-lg hover:bg-gray-750 hover:border-gray-600 group"
    >
      <div className="flex items-center mb-4">
        <div className="p-2 text-indigo-400 border rounded-lg bg-indigo-900/20 border-indigo-500/20 group-hover:bg-indigo-900/30">
          {icon}
        </div>
        <div className="flex-1 ml-3">
          <h3 className="text-lg font-medium text-white transition-colors group-hover:text-indigo-400">{title}</h3>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-gray-400 transition-colors group-hover:text-indigo-400" />
      </div>
      <p className="mb-3 text-gray-400">{description}</p>
      {features && (
        <div className="space-y-1">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center text-sm text-gray-500">
              <div className="w-1 h-1 mr-2 bg-indigo-400 rounded-full"></div>
              {feature}
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session?.user?.hasRequiredAccess) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  const { guildId } = context.params!;
  
  // Only allow access to the specific guild
  if (guildId !== TARGET_GUILD_ID) {
    return {
      notFound: true,
    };
  }

  return { props: {} };
};