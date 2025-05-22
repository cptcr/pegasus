// dashboard/pages/index.tsx
import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
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
  CommandLineIcon
} from '@heroicons/react/24/outline';

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

export default function Dashboard() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGuilds();
  }, []);

  const fetchGuilds = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/dashboard/guilds');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setGuilds(Array.isArray(data) ? data : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching guilds:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalStats = guilds.reduce((acc, guild) => ({
    totalUsers: acc.totalUsers + (guild.stats?.totalUsers || 0),
    totalWarns: acc.totalWarns + (guild.stats?.totalWarns || 0),
    activeQuarantine: acc.activeQuarantine + (guild.stats?.activeQuarantine || 0),
    totalTrackers: acc.totalTrackers + (guild.stats?.totalTrackers || 0),
    activePolls: acc.activePolls + (guild.stats?.activePolls || 0),
    activeGiveaways: acc.activeGiveaways + (guild.stats?.activeGiveaways || 0),
    openTickets: acc.openTickets + (guild.stats?.openTickets || 0),
    customCommands: acc.customCommands + (guild.stats?.customCommands || 0),
  }), {
    totalUsers: 0,
    totalWarns: 0,
    activeQuarantine: 0,
    totalTrackers: 0,
    activePolls: 0,
    activeGiveaways: 0,
    openTickets: 0,
    customCommands: 0,
  });

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

  if (error) {
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
              onClick={fetchGuilds}
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
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left">
              <summary className="text-sm text-gray-500 cursor-pointer">Technical Details</summary>
              <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
                {error}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Hinko Bot Dashboard</title>
        <meta name="description" content="Admin Dashboard for Hinko Discord Bot" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
              <h1 className="text-2xl font-bold text-indigo-600">Hinko Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                v2.0.0 • {guilds.length} server{guilds.length !== 1 ? 's' : ''}
              </span>
              <button 
                onClick={fetchGuilds}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Overall Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Users"
              value={totalStats.totalUsers}
              icon={<UsersIcon className="h-6 w-6" />}
              color="indigo"
            />
            <StatsCard
              title="Active Warnings"
              value={totalStats.totalWarns}
              icon={<ExclamationTriangleIcon className="h-6 w-6" />}
              color="red"
            />
            <StatsCard
              title="Quarantined Users"
              value={totalStats.activeQuarantine}
              icon={<ShieldCheckIcon className="h-6 w-6" />}
              color="yellow"
            />
            <StatsCard
              title="Open Tickets"
              value={totalStats.openTickets}
              icon={<TicketIcon className="h-6 w-6" />}
              color="purple"
            />
          </div>
        </div>

        {/* Community Features Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Community Activity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Active Polls"
              value={totalStats.activePolls}
              icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
              color="blue"
            />
            <StatsCard
              title="Active Giveaways"
              value={totalStats.activeGiveaways}
              icon={<GiftIcon className="h-6 w-6" />}
              color="green"
            />
            <StatsCard
              title="Custom Commands"
              value={totalStats.customCommands}
              icon={<CommandLineIcon className="h-6 w-6" />}
              color="gray"
            />
            <StatsCard
              title="Price Trackers"
              value={totalStats.totalTrackers}
              icon={<BellIcon className="h-6 w-6" />}
              color="orange"
            />
          </div>
        </div>

        {/* Servers List */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Your Servers ({guilds.length})
            </h2>
            {guilds.length === 0 && (
              <a 
                href="https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Add Bot to Server
              </a>
            )}
          </div>
          
          {guilds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {guilds.map((guild) => (
                <GuildCard key={guild.id} guild={guild} />
              ))}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No servers found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding Hinko bot to your Discord server.
              </p>
              <div className="mt-6">
                <a 
                  href="https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Add Hinko to a Server
                </a>
              </div>
            </div>
          )}
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
}

function StatsCard({ title, value, icon, color }: StatsCardProps) {
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
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

interface GuildCardProps {
  guild: Guild;
}

function GuildCard({ guild }: GuildCardProps) {
  return (
    <Link 
      href={`/dashboard/${guild.id}`}
      className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow block group"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
          {guild.name}
        </h3>
        <CogIcon className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">
          {guild.memberCount.toLocaleString()} members
        </span>
        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
          Active
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <FeatureStatus
          name="Moderation"
          enabled={guild.stats?.moderationEnabled}
          icon={<ShieldCheckIcon className="h-4 w-4" />}
        />
        <FeatureStatus
          name="Leveling"
          enabled={guild.stats?.levelingEnabled}
          icon={<ChartBarIcon className="h-4 w-4" />}
        />
        <FeatureStatus
          name="Giveaways"
          enabled={guild.stats?.enableGiveaways}
          icon={<GiftIcon className="h-4 w-4" />}
        />
        <FeatureStatus
          name="Tickets"
          enabled={guild.stats?.enableTickets}
          icon={<TicketIcon className="h-4 w-4" />}
        />
      </div>
      
      {(guild.stats?.totalWarns > 0 || guild.stats?.openTickets > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between text-xs text-gray-600">
            {guild.stats.totalWarns > 0 && (
              <span>⚠️ {guild.stats.totalWarns} warnings</span>
            )}
            {guild.stats.openTickets > 0 && (
              <span>🎫 {guild.stats.openTickets} tickets</span>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}

interface FeatureStatusProps {
  name: string;
  enabled: boolean;
  icon: React.ReactNode;
}

function FeatureStatus({ name, enabled, icon }: FeatureStatusProps) {
  return (
    <div className="flex items-center space-x-1">
      <span className={enabled ? 'text-green-500' : 'text-gray-400'}>
        {icon}
      </span>
      <span className={`text-xs ${enabled ? 'text-green-700' : 'text-gray-500'}`}>
        {name}
      </span>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // This would be replaced with actual authentication check in production
  return { props: {} };
};