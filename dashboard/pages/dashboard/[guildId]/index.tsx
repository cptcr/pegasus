// dashboard/pages/dashboard/[guildId]/index.tsx
import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
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
  CommandLineIcon
} from '@heroicons/react/24/outline';

interface GuildData {
  id: string;
  name: string;
  memberCount: number;
  stats: {
    totalUsers: number;
    totalWarns: number;
    activeQuarantine: number;
    totalTrackers: number;
    activePolls: number;
    activeGiveaways: number;
    openTickets: number;
    customCommands: number;
  };
  settings: {
    enableLeveling: boolean;
    enableModeration: boolean;
    enableGeizhals: boolean;
    enablePolls: boolean;
    enableGiveaways: boolean;
    enableTickets: boolean;
  };
}

interface RecentActivity {
  recentWarns: number;
  recentPolls: number;
  recentGiveaways: number;
  recentTickets: number;
}

export default function GuildDashboard() {
  const router = useRouter();
  const { guildId } = router.query;
  const [guildData, setGuildData] = useState<GuildData | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guildId && typeof guildId === 'string') {
      fetchGuildData(guildId);
    }
  }, [guildId]);

  const fetchGuildData = async (id: string) => {
    try {
      setLoading(true);
      const [guildResponse, activityResponse] = await Promise.all([
        fetch(`/api/dashboard/guild/${id}`),
        fetch(`/api/dashboard/activity?guildId=${id}`)
      ]);

      if (!guildResponse.ok) throw new Error('Failed to fetch guild data');
      if (!activityResponse.ok) throw new Error('Failed to fetch activity data');

      const guild = await guildResponse.json();
      const activity = await activityResponse.json();

      setGuildData(guild);
      setRecentActivity(activity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !guildData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600">{error || 'Guild not found'}</p>
          <Link href="/dashboard" className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-md">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{guildData.name} Dashboard | Hinko Bot</title>
        <meta name="description" content={`Admin Dashboard for ${guildData.name}`} />
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="mr-4 text-gray-500 hover:text-gray-700">
                ← Back
              </Link>
              <ShieldCheckIcon className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-gray-900">{guildData.name}</h1>
                <p className="text-sm text-gray-500">{guildData.memberCount} members</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                href={`/dashboard/${guildId}/settings`}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Server Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Total Users"
              value={guildData.stats.totalUsers}
              icon={<UsersIcon className="h-6 w-6" />}
              color="blue"
            />
            <StatsCard
              title="Active Warnings"
              value={guildData.stats.totalWarns}
              icon={<ExclamationTriangleIcon className="h-6 w-6" />}
              color="yellow"
              change={recentActivity ? `${recentActivity.recentWarns} this week` : undefined}
            />
            <StatsCard
              title="Quarantined"
              value={guildData.stats.activeQuarantine}
              icon={<ShieldCheckIcon className="h-6 w-6" />}
              color="red"
            />
            <StatsCard
              title="Price Trackers"
              value={guildData.stats.totalTrackers}
              icon={<BellIcon className="h-6 w-6" />}
              color="green"
            />
          </div>
        </div>

        {/* Community Features */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Community Features</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Active Polls"
              value={guildData.stats.activePolls}
              icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
              color="purple"
              change={recentActivity ? `${recentActivity.recentPolls} this week` : undefined}
            />
            <StatsCard
              title="Active Giveaways"
              value={guildData.stats.activeGiveaways}
              icon={<GiftIcon className="h-6 w-6" />}
              color="pink"
              change={recentActivity ? `${recentActivity.recentGiveaways} this week` : undefined}
            />
            <StatsCard
              title="Open Tickets"
              value={guildData.stats.openTickets}
              icon={<TicketIcon className="h-6 w-6" />}
              color="orange"
              change={recentActivity ? `${recentActivity.recentTickets} this week` : undefined}
            />
            <StatsCard
              title="Custom Commands"
              value={guildData.stats.customCommands}
              icon={<CommandLineIcon className="h-6 w-6" />}
              color="indigo"
            />
          </div>
        </div>

        {/* Feature Status and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Feature Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Status</h3>
            
            <div className="space-y-4">
              <FeatureStatus
                name="Level System"
                enabled={guildData.settings.enableLeveling}
                description="XP system and leaderboards"
              />
              <FeatureStatus
                name="Moderation"
                enabled={guildData.settings.enableModeration}
                description="Warning system and quarantine"
              />
              <FeatureStatus
                name="Geizhals Tracker"
                enabled={guildData.settings.enableGeizhals}
                description="Price tracking for hardware"
              />
              <FeatureStatus
                name="Polls"
                enabled={guildData.settings.enablePolls}
                description="Community voting"
              />
              <FeatureStatus
                name="Giveaways"
                enabled={guildData.settings.enableGiveaways}
                description="Contests and giveaways"
              />
              <FeatureStatus
                name="Tickets"
                enabled={guildData.settings.enableTickets}
                description="Support tickets"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <Link 
                href={`/dashboard/${guildId}/moderation`}
                className="p-4 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer transition-colors block"
              >
                <ShieldCheckIcon className="h-8 w-8 text-red-600 mb-2" />
                <h4 className="font-medium text-red-900">Moderation</h4>
                <p className="text-sm text-red-600">Warnings & Quarantine</p>
              </Link>

              <Link 
                href={`/dashboard/${guildId}/levels`}
                className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors block"
              >
                <ChartBarIcon className="h-8 w-8 text-blue-600 mb-2" />
                <h4 className="font-medium text-blue-900">Level System</h4>
                <p className="text-sm text-blue-600">Leaderboards & Rewards</p>
              </Link>

              <Link 
                href={`/dashboard/${guildId}/community`}
                className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg cursor-pointer transition-colors block"
              >
                <ChatBubbleLeftRightIcon className="h-8 w-8 text-purple-600 mb-2" />
                <h4 className="font-medium text-purple-900">Community</h4>
                <p className="text-sm text-purple-600">Polls & Giveaways</p>
              </Link>

              <Link 
                href={`/dashboard/${guildId}/settings`}
                className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors block"
              >
                <CogIcon className="h-8 w-8 text-gray-600 mb-2" />
                <h4 className="font-medium text-gray-900">Settings</h4>
                <p className="text-sm text-gray-600">Configure Bot</p>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

type ColorType = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'pink' | 'orange' | 'indigo';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: ColorType;
  change?: string;
}

function StatsCard({ title, value, icon, color, change }: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
    orange: 'bg-orange-50 text-orange-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="ml-4">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <p className="text-2xl font-bold">{value}</p>
          {change && <p className="text-sm text-gray-500">{change}</p>}
        </div>
      </div>
    </div>
  );
}

interface FeatureStatusProps {
  name: string;
  enabled: boolean;
  description: string;
}

function FeatureStatus({ name, enabled, description }: FeatureStatusProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-medium">{name}</h4>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className={`px-3 py-1 rounded-full ${enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
        {enabled ? 'Enabled' : 'Disabled'}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // This would be replaced with actual authentication check
  return { props: {} };
};