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
      const response = await fetch('/api/dashboard/guilds');
      
      if (!response.ok) {
        throw new Error('Failed to fetch guilds');
      }
      
      const data = await response.json();
      setGuilds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const totalStats = guilds.reduce((acc, guild) => ({
    totalUsers: acc.totalUsers + guild.stats.totalUsers,
    totalWarns: acc.totalWarns + guild.stats.totalWarns,
    activeQuarantine: acc.activeQuarantine + guild.stats.activeQuarantine,
    totalTrackers: acc.totalTrackers + guild.stats.totalTrackers,
    activePolls: acc.activePolls + guild.stats.activePolls,
    activeGiveaways: acc.activeGiveaways + guild.stats.activeGiveaways,
    openTickets: acc.openTickets + guild.stats.openTickets,
    customCommands: acc.customCommands + guild.stats.customCommands,
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
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Retry
          </button>
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
            <h1 className="text-2xl font-bold text-indigo-600">Hinko Dashboard</h1>
            <div className="flex items-center space-x-4">
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Overall Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center">
                <div className="bg-indigo-100 rounded-md p-2">
                  <UsersIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Users</p>
                  <p className="text-lg font-semibold">{totalStats.totalUsers}</p>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center">
                <div className="bg-red-100 rounded-md p-2">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Warnings</p>
                  <p className="text-lg font-semibold">{totalStats.totalWarns}</p>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-md p-2">
                  <ShieldCheckIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Active Quarantines</p>
                  <p className="text-lg font-semibold">{totalStats.activeQuarantine}</p>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center">
                <div className="bg-purple-100 rounded-md p-2">
                  <ChartBarIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Open Tickets</p>
                  <p className="text-lg font-semibold">{totalStats.openTickets}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Servers List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Servers ({guilds.length})</h2>
          {guilds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guilds.map((guild) => (
                <Link key={guild.id} href={`/dashboard/${guild.id}`}>
                  <a className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
                    <h3 className="text-lg font-semibold mb-2">{guild.name}</h3>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-500">{guild.memberCount} members</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center">
                        <ShieldCheckIcon className="h-4 w-4 mr-1 text-gray-400" />
                        <span>Moderation: {guild.stats.moderationEnabled ? 'On' : 'Off'}</span>
                      </div>
                      <div className="flex items-center">
                        <ChartBarIcon className="h-4 w-4 mr-1 text-gray-400" />
                        <span>Leveling: {guild.stats.levelingEnabled ? 'On' : 'Off'}</span>
                      </div>
                      <div className="flex items-center">
                        <GiftIcon className="h-4 w-4 mr-1 text-gray-400" />
                        <span>Giveaways: {guild.stats.enableGiveaways ? 'On' : 'Off'}</span>
                      </div>
                      <div className="flex items-center">
                        <TicketIcon className="h-4 w-4 mr-1 text-gray-400" />
                        <span>Tickets: {guild.stats.enableTickets ? 'On' : 'Off'}</span>
                      </div>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <p className="text-gray-500">No servers found. Make sure Hinko bot is added to your servers.</p>
              <a 
                href="https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands" 
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                Add Hinko to a Server
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}