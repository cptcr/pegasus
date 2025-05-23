// dashboard/pages/index.tsx (Dark Mode Enhanced)
import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
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
  PencilIcon,
  TrashIcon,
  CircleStackIcon,
  ClockIcon,
  TrendingUpIcon,
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
}

interface Guild {
  id: string;
  name: string;
  memberCount: number;
  iconURL?: string;
  stats: GuildStats;
}

interface RecentActivity {
  recentWarns: number;
  recentPolls: number;
  recentGiveaways: number;
  recentTickets: number;
}

export default function Dashboard() {
  const [guild, setGuild] = useState<Guild | null>(null);
  const [activity, setActivity] = useState<RecentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      setError(null);
      
      const [guildResponse, activityResponse] = await Promise.all([
        fetch(`/api/dashboard/guild/${TARGET_GUILD_ID}`),
        fetch(`/api/dashboard/activity?guildId=${TARGET_GUILD_ID}`)
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading dashboard...</p>
          <p className="text-sm text-gray-500">This may take a moment on first load</p>
        </div>
      </div>
    );
  }

  if (error || !guild) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-red-900/20 rounded-full p-3 w-16 h-16 mx-auto mb-4 border border-red-500/20">
            <ExclamationTriangleIcon className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Error Loading Dashboard</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => fetchDashboardData()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 mr-2 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
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
        <title>Hinko Bot Dashboard - {guild.name}</title>
        <meta name="description" content="Admin Dashboard for Hinko Discord Bot" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                {guild.iconURL ? (
                  <img src={guild.iconURL} alt="Guild Icon" className="h-8 w-8 rounded-full" />
                ) : (
                  <ShieldCheckIcon className="h-8 w-8 text-indigo-400" />
                )}
                <div>
                  <h1 className="text-2xl font-bold text-white">Hinko Dashboard</h1>
                  <p className="text-sm text-gray-400">{guild.name}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
                className="flex items-center space-x-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <QuickActionCard
              title="Settings"
              icon={<CogIcon className="h-6 w-6" />}
              href={`/dashboard/${guild.id}/settings`}
              color="blue"
            />
            <QuickActionCard
              title="Moderation"
              icon={<ShieldCheckIcon className="h-6 w-6" />}
              href={`/dashboard/${guild.id}/moderation`}
              color="red"
            />
            <QuickActionCard
              title="Levels"
              icon={<ChartBarIcon className="h-6 w-6" />}
              href={`/dashboard/${guild.id}/levels`}
              color="green"
            />
            <QuickActionCard
              title="Polls"
              icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
              href={`/dashboard/${guild.id}/polls`}
              color="purple"
            />
            <QuickActionCard
              title="Giveaways"
              icon={<GiftIcon className="h-6 w-6" />}
              href={`/dashboard/${guild.id}/giveaways`}
              color="yellow"
            />
            <QuickActionCard
              title="Tickets"
              icon={<TicketIcon className="h-6 w-6" />}
              href={`/dashboard/${guild.id}/tickets`}
              color="indigo"
            />
          </div>
        </div>

        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white">Server Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Users"
              value={guild.stats.totalUsers}
              icon={<UsersIcon className="h-6 w-6" />}
              color="indigo"
              trend="up"
              description="Active members with levels"
            />
            <StatsCard
              title="Active Warnings"
              value={guild.stats.totalWarns}
              icon={<ExclamationTriangleIcon className="h-6 w-6" />}
              color="red"
              change={activity?.recentWarns ? `+${activity.recentWarns} this week` : undefined}
              description="Unresolved user warnings"
            />
            <StatsCard
              title="Open Tickets"
              value={guild.stats.openTickets}
              icon={<TicketIcon className="h-6 w-6" />}
              color="purple"
              change={activity?.recentTickets ? `+${activity.recentTickets} this week` : undefined}
              description="Support tickets awaiting response"
            />
            <StatsCard
              title="Custom Commands"
              value={guild.stats.customCommands}
              icon={<CommandLineIcon className="h-6 w-6" />}
              color="gray"
              description="Enabled custom commands"
            />
          </div>
        </div>

        {/* Community Features Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white">Community Activity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Active Polls"
              value={guild.stats.activePolls}
              icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
              color="blue"
              change={activity?.recentPolls ? `+${activity.recentPolls} this week` : undefined}
              description="Running community polls"
            />
            <StatsCard
              title="Active Giveaways"
              value={guild.stats.activeGiveaways}
              icon={<GiftIcon className="h-6 w-6" />}
              color="green"
              change={activity?.recentGiveaways ? `+${activity.recentGiveaways} this week` : undefined}
              description="Ongoing giveaways"
            />
            <StatsCard
              title="Price Trackers"
              value={guild.stats.totalTrackers}
              icon={<BellIcon className="h-6 w-6" />}
              color="orange"
              description="Geizhals price trackers"
            />
            <StatsCard
              title="Quarantined"
              value={guild.stats.activeQuarantine}
              icon={<ShieldCheckIcon className="h-6 w-6" />}
              color="yellow"
              description="Users in quarantine"
            />
          </div>
        </div>

        {/* Feature Status */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white">Feature Status</h2>
          <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureStatus
                name="Level System"
                enabled={guild.stats.levelingEnabled}
                icon={<ChartBarIcon className="h-5 w-5" />}
                description="XP and ranking system"
                stats={`${guild.stats.totalUsers} users tracked`}
              />
              <FeatureStatus
                name="Moderation"
                enabled={guild.stats.moderationEnabled}
                icon={<ShieldCheckIcon className="h-5 w-5" />}
                description="Warning and quarantine system"
                stats={`${guild.stats.automodRules} automod rules`}
              />
              <FeatureStatus
                name="Geizhals Tracker"
                enabled={guild.stats.geizhalsEnabled}
                icon={<BellIcon className="h-5 w-5" />}
                description="Price tracking for hardware"
                stats={`${guild.stats.totalTrackers} active trackers`}
              />
              <FeatureStatus
                name="Polls"
                enabled={guild.stats.enablePolls}
                icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
                description="Community voting system"
                stats={`${guild.stats.activePolls} active polls`}
              />
              <FeatureStatus
                name="Giveaways"
                enabled={guild.stats.enableGiveaways}
                icon={<GiftIcon className="h-5 w-5" />}
                description="Contest and prize system"
                stats={`${guild.stats.activeGiveaways} running`}
              />
              <FeatureStatus
                name="Tickets"
                enabled={guild.stats.enableTickets}
                icon={<TicketIcon className="h-5 w-5" />}
                description="Support ticket system"
                stats={`${guild.stats.openTickets} open tickets`}
              />
            </div>
          </div>
        </div>

        {/* Recent Activity Summary */}
        {activity && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-white">Recent Activity (Last 7 Days)</h2>
            <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ActivitySummary
                  title="New Warnings"
                  count={activity.recentWarns}
                  color="red"
                  icon={<ExclamationTriangleIcon className="h-5 w-5" />}
                />
                <ActivitySummary
                  title="New Polls"
                  count={activity.recentPolls}
                  color="blue"
                  icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
                />
                <ActivitySummary
                  title="New Giveaways"
                  count={activity.recentGiveaways}
                  color="green"
                  icon={<GiftIcon className="h-5 w-5" />}
                />
                <ActivitySummary
                  title="New Tickets"
                  count={activity.recentTickets}
                  color="purple"
                  icon={<TicketIcon className="h-5 w-5" />}
                />
              </div>
            </div>
          </div>
        )}

        {/* Management Links */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ManagementCard
              title="Server Settings"
              description="Configure bot features and channels"
              href={`/dashboard/${guild.id}/settings`}
              icon={<CogIcon className="h-8 w-8" />}
              features={["Feature toggles", "Channel config", "Role settings"]}
            />
            <ManagementCard
              title="View Moderation"
              description="Review warnings, quarantine, and automod rules"
              href={`/dashboard/${guild.id}/moderation`}
              icon={<EyeIcon className="h-8 w-8" />}
              features={["Active warnings", "Quarantine entries", "Automod rules"]}
            />
            <ManagementCard
              title="Level System"
              description="Manage leaderboards and level rewards"
              href={`/dashboard/${guild.id}/levels`}
              icon={<ChartBarIcon className="h-8 w-8" />}
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
}

function StatsCard({ title, value, icon, color, change, trend, description }: StatsCardProps) {
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

  const iconColorClasses = {
    indigo: 'text-indigo-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    gray: 'text-gray-400',
    orange: 'text-orange-400',
  };

  return (
    <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-center">
        <div className={`p-3 rounded-full border ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <div className="flex items-center space-x-2">
            <p className="text-2xl font-semibold text-white">{value.toLocaleString()}</p>
            {trend && (
              <TrendingUpIcon 
                className={`h-4 w-4 ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400 rotate-180' : 'text-gray-400'}`} 
              />
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
          {change && (
            <p className="text-xs text-gray-400 mt-1">{change}</p>
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
}

function QuickActionCard({ title, icon, href, color }: QuickActionCardProps) {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700 border-blue-500',
    red: 'bg-red-600 hover:bg-red-700 border-red-500',
    green: 'bg-green-600 hover:bg-green-700 border-green-500',
    purple: 'bg-purple-600 hover:bg-purple-700 border-purple-500',
    yellow: 'bg-yellow-600 hover:bg-yellow-700 border-yellow-500',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500',
  };

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
    <div className="flex items-start space-x-3 p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
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
        <p className="text-sm text-gray-400 mt-1">{description}</p>
        {stats && (
          <p className="text-xs text-gray-500 mt-1">{stats}</p>
        )}
      </div>
    </div>
  );
}

interface ActivitySummaryProps {
  title: string;
  count: number;
  color: 'red' | 'blue' | 'green' | 'purple';
  icon: React.ReactNode;
}

function ActivitySummary({ title, count, color, icon }: ActivitySummaryProps) {
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
      className="bg-gray-800 shadow-lg rounded-lg p-6 hover:bg-gray-750 transition-all duration-200 block border border-gray-700 hover:border-gray-600 group"
    >
      <div className="flex items-center mb-4">
        <div className="p-2 bg-indigo-900/20 text-indigo-400 rounded-lg border border-indigo-500/20 group-hover:bg-indigo-900/30">
          {icon}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-lg font-medium text-white group-hover:text-indigo-400 transition-colors">{title}</h3>
        </div>
        <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-indigo-400 transition-colors" />
      </div>
      <p className="text-gray-400 mb-3">{description}</p>
      {features && (
        <div className="space-y-1">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center text-sm text-gray-500">
              <div className="w-1 h-1 bg-indigo-400 rounded-full mr-2"></div>
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

  return { props: {} };
};