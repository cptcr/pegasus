// dashboard/pages/index.tsx
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
  TrashIcon
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
  levelingEnabled: boolean;
  moderationEnabled: boolean;
  geizhalsEnabled: boolean;
  enablePolls: boolean;
  enableGiveaways: boolean;
  enableTickets: boolean;
}

interface Guild {
  id: string;
  name: string;
  memberCount: number;
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
          <p className="text-sm text-gray-500">This may take a moment on first load</p>
        </div>
      </div>
    );
  }

  if (error || !guild) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-red-100 rounded-full p-3 w-16 h-16 mx-auto mb-4">
            <ExclamationTriangleIcon className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Dashboard</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={fetchDashboardData}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 mr-2"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Hinko Bot Dashboard - {guild.name}</title>
        <meta name="description" content="Admin Dashboard for Hinko Discord Bot" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-indigo-600">Hinko Dashboard</h1>
                <p className="text-sm text-gray-500">{guild.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                v2.0.0 • {guild.memberCount.toLocaleString()} members
              </span>
              <button 
                onClick={fetchDashboardData}
                disabled={refreshing}
                className="flex items-center space-x-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Quick Actions</h2>
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
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Server Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Users"
              value={guild.stats.totalUsers}
              icon={<UsersIcon className="h-6 w-6" />}
              color="indigo"
              change={activity?.recentWarns ? `+${activity.recentWarns} this week` : undefined}
            />
            <StatsCard
              title="Active Warnings"
              value={guild.stats.totalWarns}
              icon={<ExclamationTriangleIcon className="h-6 w-6" />}
              color="red"
              change={activity?.recentWarns ? `+${activity.recentWarns} this week` : undefined}
            />
            <StatsCard
              title="Open Tickets"
              value={guild.stats.openTickets}
              icon={<TicketIcon className="h-6 w-6" />}
              color="purple"
              change={activity?.recentTickets ? `+${activity.recentTickets} this week` : undefined}
            />
            <StatsCard
              title="Custom Commands"
              value={guild.stats.customCommands}
              icon={<CommandLineIcon className="h-6 w-6" />}
              color="gray"
            />
          </div>
        </div>

        {/* Community Features Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Community Activity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Active Polls"
              value={guild.stats.activePolls}
              icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
              color="blue"
              change={activity?.recentPolls ? `+${activity.recentPolls} this week` : undefined}
            />
            <StatsCard
              title="Active Giveaways"
              value={guild.stats.activeGiveaways}
              icon={<GiftIcon className="h-6 w-6" />}
              color="green"
              change={activity?.recentGiveaways ? `+${activity.recentGiveaways} this week` : undefined}
            />
            <StatsCard
              title="Price Trackers"
              value={guild.stats.totalTrackers}
              icon={<BellIcon className="h-6 w-6" />}
              color="orange"
            />
            <StatsCard
              title="Quarantined"
              value={guild.stats.activeQuarantine}
              icon={<ShieldCheckIcon className="h-6 w-6" />}
              color="yellow"
            />
          </div>
        </div>

        {/* Feature Status */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Feature Status</h2>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureStatus
                name="Level System"
                enabled={guild.stats.levelingEnabled}
                icon={<ChartBarIcon className="h-5 w-5" />}
                description="XP and ranking system"
              />
              <FeatureStatus
                name="Moderation"
                enabled={guild.stats.moderationEnabled}
                icon={<ShieldCheckIcon className="h-5 w-5" />}
                description="Warning and quarantine system"
              />
              <FeatureStatus
                name="Geizhals Tracker"
                enabled={guild.stats.geizhalsEnabled}
                icon={<BellIcon className="h-5 w-5" />}
                description="Price tracking for hardware"
              />
              <FeatureStatus
                name="Polls"
                enabled={guild.stats.enablePolls}
                icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
                description="Community voting system"
              />
              <FeatureStatus
                name="Giveaways"
                enabled={guild.stats.enableGiveaways}
                icon={<GiftIcon className="h-5 w-5" />}
                description="Contest and prize system"
              />
              <FeatureStatus
                name="Tickets"
                enabled={guild.stats.enableTickets}
                icon={<TicketIcon className="h-5 w-5" />}
                description="Support ticket system"
              />
            </div>
          </div>
        </div>

        {/* Recent Activity Summary */}
        {activity && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Recent Activity (Last 7 Days)</h2>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ActivitySummary
                  title="New Warnings"
                  count={activity.recentWarns}
                  color="red"
                />
                <ActivitySummary
                  title="New Polls"
                  count={activity.recentPolls}
                  color="blue"
                />
                <ActivitySummary
                  title="New Giveaways"
                  count={activity.recentGiveaways}
                  color="green"
                />
                <ActivitySummary
                  title="New Tickets"
                  count={activity.recentTickets}
                  color="purple"
                />
              </div>
            </div>
          </div>
        )}

        {/* Management Links */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ManagementCard
              title="Server Settings"
              description="Configure bot features and channels"
              href={`/dashboard/${guild.id}/settings`}
              icon={<CogIcon className="h-8 w-8" />}
            />
            <ManagementCard
              title="View Moderation"
              description="Review warnings, quarantine, and automod rules"
              href={`/dashboard/${guild.id}/moderation`}
              icon={<EyeIcon className="h-8 w-8" />}
            />
            <ManagementCard
              title="Level System"
              description="Manage leaderboards and level rewards"
              href={`/dashboard/${guild.id}/levels`}
              icon={<ChartBarIcon className="h-8 w-8" />}
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
}

function StatsCard({ title, value, icon, color, change }: StatsCardProps) {
  const colorClasses = {
    indigo: 'bg-indigo-100 text-indigo-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    gray: 'bg-gray-100 text-gray-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value.toLocaleString()}</p>
          {change && (
            <p className="text-xs text-gray-500 mt-1">{change}</p>
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
    blue: 'bg-blue-500 hover:bg-blue-600',
    red: 'bg-red-500 hover:bg-red-600',
    green: 'bg-green-500 hover:bg-green-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
    yellow: 'bg-yellow-500 hover:bg-yellow-600',
    indigo: 'bg-indigo-500 hover:bg-indigo-600',
  };

  return (
    <Link 
      href={href}
      className={`${colorClasses[color]} text-white p-4 rounded-lg shadow transition-colors flex flex-col items-center text-center`}
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
}

function FeatureStatus({ name, enabled, icon, description }: FeatureStatusProps) {
  return (
    <div className="flex items-start space-x-3">
      <div className={`p-2 rounded-md ${enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-medium text-gray-900">{name}</h4>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}

interface ActivitySummaryProps {
  title: string;
  count: number;
  color: 'red' | 'blue' | 'green' | 'purple';
}

function ActivitySummary({ title, count, color }: ActivitySummaryProps) {
  const colorClasses = {
    red: 'text-red-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
  };

  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>
        {count.toLocaleString()}
      </div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
}

interface ManagementCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

function ManagementCard({ title, description, href, icon }: ManagementCardProps) {
  return (
    <Link 
      href={href}
      className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-center mb-4">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
          {icon}
        </div>
        <h3 className="ml-3 text-lg font-medium text-gray-900">{title}</h3>
      </div>
      <p className="text-gray-600">{description}</p>
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