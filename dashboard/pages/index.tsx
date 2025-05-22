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

interface DashboardProps {
  user: {
    id: string;
    username: string;
    avatar: string;
  };
  guilds: Guild[];
}

export default function Dashboard({ user, guilds }: DashboardProps) {
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any>(null);

  useEffect(() => {
    if (guilds.length > 0 && !selectedGuild) {
      setSelectedGuild(guilds[0].id);
    }
  }, [guilds, selectedGuild]);

  useEffect(() => {
    if (selectedGuild) {
      fetchRecentActivity(selectedGuild);
    }
  }, [selectedGuild]);

  const fetchRecentActivity = async (guildId: string) => {
    try {
      const response = await fetch(`/api/dashboard/activity?guildId=${guildId}`);
      const data = await response.json();
      setRecentActivity(data);
    } catch (error) {
      console.error('Fehler beim Laden der Aktivitäten:', error);
    }
  };

  const currentGuild = guilds.find(g => g.id === selectedGuild);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Hinko Bot Dashboard</title>
        <meta name="description" content="Admin Dashboard für Hinko Discord Bot" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShieldCheckIcon className="h-8 w-8 text-indigo-600" />
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-gray-900">Hinko Bot Dashboard</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Guild Selector */}
              <select
                value={selectedGuild}
                onChange={(e) => setSelectedGuild(e.target.value)}
                className="block w-64 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="">Alle Server</option>
                {guilds.map(guild => (
                  <option key={guild.id} value={guild.id}>
                    {guild.name} ({guild.memberCount} Member)
                  </option>
                ))}
              </select>

              {/* User Info */}
              <div className="flex items-center space-x-3">
                <img
                  className="h-8 w-8 rounded-full"
                  src={user.avatar}
                  alt={user.username}
                />
                <span className="text-sm font-medium text-gray-700">{user.username}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {currentGuild ? `${currentGuild.name} Übersicht` : 'Gesamtübersicht'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Benutzer"
              value={currentGuild ? currentGuild.stats.totalUsers : totalStats.totalUsers}
              icon={<UsersIcon className="h-6 w-6" />}
              color="blue"
              change="+12% seit letztem Monat"
            />
            <StatsCard
              title="Aktive Warnungen"
              value={currentGuild ? currentGuild.stats.totalWarns : totalStats.totalWarns}
              icon={<ExclamationTriangleIcon className="h-6 w-6" />}
              color="yellow"
              change={recentActivity ? `${recentActivity.recentWarns} diese Woche` : undefined}
            />
            <StatsCard
              title="Quarantäne"
              value={currentGuild ? currentGuild.stats.activeQuarantine : totalStats.activeQuarantine}
              icon={<ShieldCheckIcon className="h-6 w-6" />}
              color="red"
              change="Aktive Einträge"
            />
            <StatsCard
              title="Preis-Tracker"
              value={currentGuild ? currentGuild.stats.totalTrackers : totalStats.totalTrackers}
              icon={<BellIcon className="h-6 w-6" />}
              color="green"
              change="Überwachte Produkte"
            />
          </div>
        </div>

        {/* Feature Stats */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Community Features</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Aktive Umfragen"
              value={currentGuild ? currentGuild.stats.activePolls : totalStats.activePolls}
              icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
              color="purple"
              change={recentActivity ? `${recentActivity.recentPolls} diese Woche` : undefined}
            />
            <StatsCard
              title="Laufende Giveaways"
              value={currentGuild ? currentGuild.stats.activeGiveaways : totalStats.activeGiveaways}
              icon={<GiftIcon className="h-6 w-6" />}
              color="pink"
              change={recentActivity ? `${recentActivity.recentGiveaways} diese Woche` : undefined}
            />
            <StatsCard
              title="Offene Tickets"
              value={currentGuild ? currentGuild.stats.openTickets : totalStats.openTickets}
              icon={<TicketIcon className="h-6 w-6" />}
              color="orange"
              change={recentActivity ? `${recentActivity.recentTickets} diese Woche` : undefined}
            />
            <StatsCard
              title="Custom Commands"
              value={currentGuild ? currentGuild.stats.customCommands : totalStats.customCommands}
              icon={<CommandLineIcon className="h-6 w-6" />}
              color="indigo"
              change="Verfügbare Commands"
            />
          </div>
        </div>

        {/* Feature Status und Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Feature Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Feature Status {currentGuild && `- ${currentGuild.name}`}
            </h3>
            
            {currentGuild ? (
              <div className="space-y-4">
                <FeatureStatus
                  name="Level System"
                  enabled={currentGuild.stats.levelingEnabled}
                  description="XP-System und Leaderboards"
                />
                <FeatureStatus
                  name="Moderation"
                  enabled={currentGuild.stats.moderationEnabled}
                  description="Warn-System und Quarantäne"
                />
                <FeatureStatus
                  name="Geizhals Tracker"
                  enabled={currentGuild.stats.geizhalsEnabled}
                  description="Preisverfolgun für Hardware"
                />
                <FeatureStatus
                  name="Umfragen"
                  enabled={currentGuild.stats.enablePolls}
                  description="Community Abstimmungen"
                />
                <FeatureStatus
                  name="Giveaways"
                  enabled={currentGuild.stats.enableGiveaways}
                  description="Gewinnspiele und Verlosungen"
                />
                <FeatureStatus
                  name="Ticket System"
                  enabled={currentGuild.stats.enableTickets}
                  description="Support-Tickets"
                />
              </div>
            ) : (
              <p className="text-gray-500">Wähle einen Server aus, um Feature-Status zu sehen.</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Schnellzugriff</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <Link href={`/dashboard/moderation${currentGuild ? `?guild=${currentGuild.id}` : ''}`}>
                <div className="p-4 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer transition-colors">
                  <ShieldCheckIcon className="h-8 w-8 text-red-600 mb-2" />
                  <h4 className="font-medium text-red-900">Moderation</h4>
                  <p className="text-sm text-red-600">Warnungen & Quarantäne</p>
                </div>
              </Link>

              <Link href={`/dashboard/levels${currentGuild ? `?guild=${currentGuild.id}` : ''}`}>
                <div className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors">
                  <ChartBarIcon className="h-8 w-8 text-blue-600 mb-2" />
                  <h4 className="font-medium text-blue-900">Level System</h4>
                  <p className="text-sm text-blue-600">Leaderboards & Rewards</p>
                </div>
              </Link>

              <Link href={`/dashboard/community${currentGuild ? `?guild=${currentGuild.id}` : ''}`}>
                <div className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg cursor-pointer transition-colors">
                  <ChatBubbleLeftRightIcon className="h-8 w-8 text-purple-600 mb-2" />
                  <h4 className="font-medium text-purple-900">Community</h4>
                  <p className="text-sm text-purple-600">Polls & Giveaways</p>
                </div>
              </Link>

              <Link href={`/dashboard/settings${currentGuild ? `?guild=${currentGuild.id}` : ''}`}>
                <div className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                  <CogIcon className="h-8 w-8 text-gray-600 mb-2" />
                  <h4 className="font-medium text-gray-900">Einstellungen</h4>
                  <p className="text-sm text-gray-600">Bot konfigurieren</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {recentActivity && currentGuild && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Letzte Aktivitäten (24h) - {currentGuild.name}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActivityItem 
                icon={<ExclamationTriangleIcon className="h-5 w-5" />}
                count={recentActivity.recentWarns}
                label="Warnungen"
                color="yellow"
              />
              <ActivityItem 
                icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
                count={recentActivity.recentPolls}
                label="Umfragen"
                color="purple"
              />
              <ActivityItem 
                icon={<GiftIcon className="h-5 w-5" />}
                count={recentActivity.recentGiveaways}
                label="Giveaways"
                color="pink"
              />
              <ActivityItem 
                icon={<TicketIcon className="h-5 w-5" />}
                count={recentActivity.recentTickets}
                label="Tickets"
                color="orange"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Component für Statistik-Karten
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

// Component für Feature Status
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
        {enabled ? 'Aktiviert' : 'Deaktiviert'}
      </div>
    </div>
  );
}

// Component für Aktivitäten
interface ActivityItemProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  color: ColorType;
}

function ActivityItem({ icon, count, label, color }: ActivityItemProps) {
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
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center space-x-2">
        <div className={`p-2 rounded-full ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xl font-bold">{count}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Placeholder für echte API Calls
  const dummyUser = {
    id: '123456789',
    username: 'Admin',
    avatar: 'https://via.placeholder.com/150',
  };

  const dummyGuilds = [
    {
      id: '111222333',
      name: 'Test Server 1',
      memberCount: 156,
      stats: {
        totalUsers: 156,
        totalWarns: 3,
        activeQuarantine: 1,
        totalTrackers: 5,
        activePolls: 2,
        activeGiveaways: 1,
        openTickets: 4,
        customCommands: 8,
        levelingEnabled: true,
        moderationEnabled: true,
        geizhalsEnabled: true,
        enablePolls: true,
        enableGiveaways: true,
        enableTickets: true,
      }
    },
    {
      id: '444555666',
      name: 'Test Server 2',
      memberCount: 87,
      stats: {
        totalUsers: 87,
        totalWarns: 0,
        activeQuarantine: 0,
        totalTrackers: 2,
        activePolls: 1,
        activeGiveaways: 0,
        openTickets: 1,
        customCommands: 3,
        levelingEnabled: true,
        moderationEnabled: false,
        geizhalsEnabled: false,
        enablePolls: true,
        enableGiveaways: false,
        enableTickets: true,
      }
    }
  ];

  return {
    props: {
      user: dummyUser,
      guilds: dummyGuilds
    }
  };
};