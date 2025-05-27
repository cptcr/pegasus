// dashboard/pages/dashboard/[guildId]/index.tsx - Fixed ESLint Issues
import { useState, useEffect, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
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
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { ConnectionStatus } from '../../../components/StatusIndicator';
import { RealtimeNotifications } from '../../../components/EventNotifications';

const TARGET_GUILD_ID = '554266392262737930';

interface MetricCardProps {
  title: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'red' | 'yellow' | 'indigo';
  max?: number;
  subtext?: string;
  description: string;
}

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

export default function ModernGuildDashboard() {
  const router = useRouter();
  const { guildId } = router.query;
  const [guild, setGuild] = useState<Guild | null>(null);
  const [activity, setActivity] = useState<RecentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchDashboardData = useCallback(async (silent = false) => {
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
  }, [guildId]);

  useEffect(() => {
    if (guildId && typeof guildId === 'string') {
      fetchDashboardData();
      
      const interval = setInterval(() => {
        fetchDashboardData(true);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [guildId, fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen transition-colors duration-200 bg-gray-50 dark:bg-gray-900">
        <div className="space-y-6 text-center">
          <div className="relative">
            <div className="w-32 h-32 mx-auto">
              <div className="absolute inset-0 border-4 border-indigo-200 rounded-full dark:border-indigo-800 animate-pulse"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <ChartBarIcon className="absolute w-16 h-16 text-indigo-600 transform -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Loading Dashboard
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Fetching real-time data from database...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !guild) {
    return (
      <div className="flex items-center justify-center min-h-screen transition-colors duration-200 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto space-y-6 text-center">
          <div className="w-20 h-20 p-4 mx-auto bg-red-100 rounded-full dark:bg-red-900/20">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
              Error Loading Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => fetchDashboardData()}
              className="btn-primary"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-200 bg-gray-50 dark:bg-gray-900">
      <Head>
        <title>Pegasus Bot Dashboard - {guild.name}</title>
        <meta name="description" content="Admin Dashboard for Pegasus Discord Bot" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Real-time Notifications */}
      <RealtimeNotifications guildId={guildId as string} />

      {/* Header Section */}
      <header className="sticky z-30 border-b border-gray-200 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md dark:border-gray-700 top-16">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-4">
                {guild.iconURL ? (
                  <Image 
                    src={guild.iconURL} 
                    alt="Guild Icon" 
                    width={48}
                    height={48}
                    className="shadow-lg rounded-xl ring-2 ring-indigo-500/20" 
                  />
                ) : (
                  <div className="flex items-center justify-center w-12 h-12 shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                    <ShieldCheckIcon className="text-white w-7 h-7" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold gradient-text">
                    {guild.name}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {guild.memberCount.toLocaleString()} members • v2.0.0
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Status Indicators */}
              <div className="items-center hidden space-x-4 lg:flex">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    guild.status.botOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Bot {guild.status.botOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    guild.status.databaseConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Database
                  </span>
                </div>
                <ConnectionStatus guildId={guildId as string} />
              </div>
              
              {lastUpdate && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </div>
              )}
              
              <button 
                onClick={() => fetchDashboardData()}
                disabled={refreshing}
                className="btn-secondary"
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
        
        {/* Quick Actions Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Quick Actions
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Jump to any section
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <QuickActionCard
              title="Settings"
              icon={<CogIcon className="w-6 h-6" />}
              href={`/dashboard/${guild.id}/settings`}
              color="blue"
              description="Configure bot features"
            />
            <QuickActionCard
              title="Moderation"
              icon={<ShieldCheckIcon className="w-6 h-6" />}
              href={`/dashboard/${guild.id}/moderation`}
              color="red"
              description="Manage warnings & quarantine"
            />
            <QuickActionCard
              title="Levels"
              icon={<ChartBarIcon className="w-6 h-6" />}
              href={`/dashboard/${guild.id}/levels`}
              color="green"
              description="View leaderboards"
            />
            <QuickActionCard
              title="Polls"
              icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}
              href={`#`}
              color="purple"
              disabled={!guild.stats.enablePolls}
              description="Community voting"
            />
            <QuickActionCard
              title="Giveaways"
              icon={<GiftIcon className="w-6 h-6" />}
              href={`#`}
              color="yellow"
              disabled={!guild.stats.enableGiveaways}
              description="Manage contests"
            />
            <QuickActionCard
              title="Tickets"
              icon={<TicketIcon className="w-6 h-6" />}
              href={`#`}
              color="indigo"
              disabled={!guild.stats.enableTickets}
              description="Support system"
            />
          </div>
        </section>

        {/* Overview Stats */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Server Overview
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Real-time statistics
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ModernStatsCard
              title="Active Users"
              value={guild.stats.totalUsers}
              icon={<UsersIcon className="w-6 h-6" />}
              color="blue"
              trend="up"
              description="Users with XP tracked"
              change={`${guild.stats.engagementRate}% of members`}
            />
            <ModernStatsCard
              title="Active Warnings"
              value={guild.stats.totalWarns}
              icon={<ExclamationTriangleIcon className="w-6 h-6" />}
              color="red"
              change={activity?.today.recentWarns ? `+${activity.today.recentWarns} today` : undefined}
              description="Unresolved user warnings"
            />
            <ModernStatsCard
              title="Open Tickets"
              value={guild.stats.openTickets}
              icon={<TicketIcon className="w-6 h-6" />}
              color="purple"
              change={activity?.today.recentTickets ? `+${activity.today.recentTickets} today` : undefined}
              description="Support tickets awaiting response"
            />
            <ModernStatsCard
              title="Custom Commands"
              value={guild.stats.customCommands}
              icon={<CommandLineIcon className="w-6 h-6" />}
              color="gray"
              description="Enabled custom commands"
            />
          </div>
        </section>

        {/* Community Activity Stats */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Community Activity
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Last 24 hours
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ModernStatsCard
              title="Active Polls"
              value={guild.stats.activePolls}
              icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}
              color="blue"
              change={activity?.today.recentPolls ? `+${activity.today.recentPolls} today` : undefined}
              description="Running community polls"
              disabled={!guild.stats.enablePolls}
            />
            <ModernStatsCard
              title="Active Giveaways"
              value={guild.stats.activeGiveaways}
              icon={<GiftIcon className="w-6 h-6" />}
              color="green"
              change={activity?.today.recentGiveaways ? `+${activity.today.recentGiveaways} today` : undefined}
              description="Ongoing giveaways"
              disabled={!guild.stats.enableGiveaways}
            />
            <ModernStatsCard
              title="Price Trackers"
              value={guild.stats.totalTrackers}
              icon={<BellIcon className="w-6 h-6" />}
              color="orange"
              description="Geizhals price trackers"
              disabled={!guild.stats.geizhalsEnabled}
            />
            <ModernStatsCard
              title="Quarantined"
              value={guild.stats.activeQuarantine}
              icon={<ShieldCheckIcon className="w-6 h-6" />}
              color="yellow"
              description="Users in quarantine"
            />
          </div>
        </section>

        {/* Activity Metrics */}
        {activity && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Performance Metrics
              </h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Server health indicators
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <MetricCard
                title="Activity Score"
                value={activity.metrics.activityScore}
                description="Overall server activity"
                color="blue"
                max={100}
              />
              <MetricCard
                title="Health Score"
                value={activity.metrics.healthScore}
                description="Server health status"
                color="green"
                max={100}
              />
              <MetricCard
                title="Weekly Events"
                value={activity.metrics.totalEvents}
                description="Total events this week"
                color="purple"
                subtext={`${Math.round(activity.metrics.totalEvents / 7 * 10) / 10} per day avg`}
              />
            </div>
          </section>
        )}

        {/* Feature Status Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Feature Status
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Current configuration
            </div>
          </div>
          <div className="p-6 card">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FeatureStatusCard
                name="Level System"
                enabled={guild.stats.levelingEnabled}
                icon={<ChartBarIcon className="w-5 h-5" />}
                description="XP and ranking system"
                stats={`${guild.stats.totalUsers} users tracked`}
              />
              <FeatureStatusCard
                name="Moderation"
                enabled={guild.stats.moderationEnabled}
                icon={<ShieldCheckIcon className="w-5 h-5" />}
                description="Warning and quarantine system"
                stats={`${guild.stats.automodRules} automod rules`}
              />
              <FeatureStatusCard
                name="Geizhals Tracker"
                enabled={guild.stats.geizhalsEnabled}
                icon={<BellIcon className="w-5 h-5" />}
                description="Price tracking for hardware"
                stats={`${guild.stats.totalTrackers} active trackers`}
              />
              <FeatureStatusCard
                name="Polls"
                enabled={guild.stats.enablePolls}
                icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
                description="Community voting system"
                stats={`${guild.stats.activePolls} active polls`}
              />
              <FeatureStatusCard
                name="Giveaways"
                enabled={guild.stats.enableGiveaways}
                icon={<GiftIcon className="w-5 h-5" />}
                description="Contest and prize system"
                stats={`${guild.stats.activeGiveaways} running`}
              />
              <FeatureStatusCard
                name="Tickets"
                enabled={guild.stats.enableTickets}
                icon={<TicketIcon className="w-5 h-5" />}
                description="Support ticket system"
                stats={`${guild.stats.openTickets} open tickets`}
              />
            </div>
          </div>
        </section>

        {/* Recent Activity Summary */}
        {activity && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Recent Activity
              </h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Last 7 days
              </div>
            </div>
            <div className="p-6 card">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <ActivitySummaryCard
                  title="New Warnings"
                  count={activity.recentWarns}
                  dailyAvg={activity.metrics.averageDaily.warns}
                  color="red"
                  icon={<ExclamationTriangleIcon className="w-5 h-5" />}
                />
                <ActivitySummaryCard
                  title="New Polls"
                  count={activity.recentPolls}
                  dailyAvg={activity.metrics.averageDaily.polls}
                  color="blue"
                  icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
                />
                <ActivitySummaryCard
                  title="New Giveaways"
                  count={activity.recentGiveaways}
                  dailyAvg={activity.metrics.averageDaily.giveaways}
                  color="green"
                  icon={<GiftIcon className="w-5 h-5" />}
                />
                <ActivitySummaryCard
                  title="New Tickets"
                  count={activity.recentTickets}
                  dailyAvg={activity.metrics.averageDaily.tickets}
                  color="purple"
                  icon={<TicketIcon className="w-5 h-5" />}
                />
              </div>
            </div>
          </section>
        )}

        {/* Management Links */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Management
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Quick access to tools
            </div>
          </div>
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
        </section>
      </main>
    </div>
  );
}

// Component interfaces and implementations
interface ModernStatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'yellow' | 'purple' | 'green' | 'gray' | 'orange';
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  disabled?: boolean;
}

function ModernStatsCard({ title, value, icon, color, change, trend, description, disabled }: ModernStatsCardProps) {
  const colorClasses = {
    blue: 'from-blue-500/10 to-indigo-500/10 border-blue-200 dark:border-blue-800',
    red: 'from-red-500/10 to-rose-500/10 border-red-200 dark:border-red-800',
    yellow: 'from-yellow-500/10 to-orange-500/10 border-yellow-200 dark:border-yellow-800',
    purple: 'from-purple-500/10 to-violet-500/10 border-purple-200 dark:border-purple-800',
    green: 'from-green-500/10 to-emerald-500/10 border-green-200 dark:border-green-800',
    gray: 'from-gray-500/10 to-slate-500/10 border-gray-200 dark:border-gray-600',
    orange: 'from-orange-500/10 to-amber-500/10 border-orange-200 dark:border-orange-800',
  };

  const iconColorClasses = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20',
    red: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
    yellow: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20',
    green: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
    gray: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20',
  };

  return (
    <div className={`card bg-gradient-to-br ${colorClasses[color]} ${disabled ? 'opacity-50' : ''} hover:shadow-lg transition-all duration-200`}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-xl ${iconColorClasses[color]}`}>
            {icon}
          </div>
          {trend && (
            <div className={`text-sm ${trend === 'up' ? 'text-green-600 dark:text-green-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {trend === 'up' && '↗'}
              {trend === 'down' && '↘'}
              {trend === 'neutral' && '→'}
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="flex items-baseline space-x-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {value.toLocaleString()}
            </h3>
            {disabled && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                (Disabled)
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          {description && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              {description}
            </p>
          )}
          {change && (
            <p className="mt-2 text-xs font-medium text-gray-600 dark:text-gray-300">
              {change}
            </p>
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
  color: 'blue' | 'red' | 'yellow' | 'purple' | 'green' | 'indigo';
  description?: string;
  disabled?: boolean;
}

function QuickActionCard({ title, icon, href, color, description, disabled }: QuickActionCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    red: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
    yellow: 'from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    indigo: 'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
  };

  return disabled ? (
    <div className={`group relative overflow-hidden rounded-xl p-4 text-white transition-all duration-300 bg-gray-400 cursor-not-allowed opacity-60`}>
      <div className="flex flex-col items-center space-y-2 text-center">
        <div className="p-2 transition-colors duration-200 rounded-lg bg-white/20">
          {icon}
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-xs opacity-90">{description}</p>
        )}
        <span className="text-xs opacity-75">(Disabled)</span>
      </div>
    </div>
  ) : (
    <Link href={href}>
      <div className={`group relative overflow-hidden rounded-xl p-4 text-white transition-all duration-300 bg-gradient-to-br ${colorClasses[color]} cursor-pointer transform hover:scale-105 hover:shadow-xl`}>
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="p-2 transition-colors duration-200 rounded-lg bg-white/20 group-hover:bg-white/30">
            {icon}
          </div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="text-xs opacity-90">{description}</p>
          )}
        </div>
        <div className="absolute inset-0 transition-colors duration-300 bg-white/0 group-hover:bg-white/10 rounded-xl"></div>
      </div>
    </Link>
  );
}

function MetricCard({
  title,
  value,
  color,
  max,
  subtext,
  description,
}: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    indigo: 'bg-indigo-500',
  };

  const percentage = max !== undefined ? (value / max) * 100 : undefined;

  return (
    <div className="p-6 card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {percentage !== undefined ? `${Math.round(percentage)}%` : value.toLocaleString()}
        </div>
      </div>

      {subtext && (
        <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {subtext}
        </div>
      )}

      {max !== undefined && (
        <div className="w-full h-2 mb-3 bg-gray-200 rounded-full dark:bg-gray-700">
          <div
            className={`h-2 rounded-full ${colorClasses[color]} transition-all duration-500 ease-out`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      )}

      <p className="text-sm text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

interface FeatureStatusCardProps {
  name: string;
  enabled: boolean;
  icon: React.ReactNode;
  description: string;
  stats?: string;
}

function FeatureStatusCard({ name, enabled, icon, description, stats }: FeatureStatusCardProps) {
  return (
    <div className="flex items-start p-4 space-x-3 border border-gray-200 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className={`p-2 rounded-lg ${enabled ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {name}
          </h4>
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            enabled 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {enabled ? (
              <>
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                Enabled
              </>
            ) : (
              <>
                <XCircleIcon className="w-3 h-3 mr-1" />
                Disabled
              </>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
        {stats && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            {stats}
          </p>
        )}
      </div>
    </div>
  );
}

interface ActivitySummaryCardProps {
  title: string;
  count: number;
  dailyAvg: number;
  color: 'red' | 'blue' | 'green' | 'purple';
  icon: React.ReactNode;
}

function ActivitySummaryCard({ title, count, dailyAvg, color, icon }: ActivitySummaryCardProps) {
  const colorClasses = {
    red: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20',
    green: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20',
  };

  return (
    <div className="text-center">
      <div className={`inline-flex p-3 rounded-full ${colorClasses[color]} mb-3`}>
        {icon}
      </div>
      <div className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {count}
      </div>
      <div className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        {title}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {dailyAvg.toFixed(1)} per day avg
      </div>
    </div>
  );
}

interface ManagementCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  features: string[];
}

function ManagementCard({ title, description, href, icon, features }: ManagementCardProps) {
  return (
    <Link href={href}>
      <div className="h-full p-6 card-interactive">
        <div className="flex items-start mb-4 space-x-4">
          <div className="p-3 text-indigo-600 bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-xl">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-gray-400 transition-colors duration-200 group-hover:text-indigo-500" />
        </div>
        <div className="space-y-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  const { guildId } = context.params!;

  if (!session?.user?.hasRequiredAccess) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  if (guildId !== TARGET_GUILD_ID) {
    return {
      redirect: {
        destination: `/dashboard/${TARGET_GUILD_ID}`,
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};