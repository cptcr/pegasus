import { useState, useEffect } from 'react';
import Head from 'next/head';
import { 
  ChartBarIcon, 
  UsersIcon, 
  ExclamationTriangleIcon, 
  ShieldCheckIcon,
  CogIcon,
  BellIcon
} from '@heroicons/react/24/outline';

interface GuildStats {
  totalUsers: number;
  totalWarns: number;
  activeQuarantine: number;
  totalTrackers: number;
  levelingEnabled: boolean;
  moderationEnabled: boolean;
  geizhalsEnabled: boolean;
}

interface Guild {
  id: string;
  name: string;
  stats: GuildStats;
}

export default function Dashboard() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGuilds();
  }, []);

  const fetchGuilds = async () => {
    try {
      const response = await fetch('/api/dashboard/guilds');
      const data = await response.json();
      setGuilds(data);
      if (data.length > 0) {
        setSelectedGuild(data[0].id);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Guilds:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentGuild = guilds.find(g => g.id === selectedGuild);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Discord Bot Dashboard</title>
        <meta name="description" content="Admin Dashboard für Discord Bot" />
      </Head>

      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 w-8 text-blue-500 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">Discord Bot Dashboard</h1>
            </div>
            
            {/* Guild Selector */}
            <div className="flex items-center space-x-4">
              <select
                value={selectedGuild}
                onChange={(e) => setSelectedGuild(e.target.value)}
                className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {guilds.map(guild => (
                  <option key={guild.id} value={guild.id}>
                    {guild.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {currentGuild && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatsCard
                title="Gesamte Benutzer"
                value={currentGuild.stats.totalUsers}
                icon={<UsersIcon className="h-6 w-6" />}
                color="blue"
              />
              <StatsCard
                title="Aktive Warnungen"
                value={currentGuild.stats.totalWarns}
                icon={<ExclamationTriangleIcon className="h-6 w-6" />}
                color="yellow"
              />
              <StatsCard
                title="Quarantäne"
                value={currentGuild.stats.activeQuarantine}
                icon={<ShieldCheckIcon className="h-6 w-6" />}
                color="red"
              />
              <StatsCard
                title="Preis-Tracker"
                value={currentGuild.stats.totalTrackers}
                icon={<BellIcon className="h-6 w-6" />}
                color="green"
              />
            </div>

            {/* Feature Status */}
            <div className="bg-white shadow rounded-lg p-6 mb-8">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Feature Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FeatureStatus
                  name="Level System"
                  enabled={currentGuild.stats.levelingEnabled}
                  description="XP-System und Leaderboards"
                />
                <FeatureStatus
                  name="Moderation"
                  enabled={currentGuild.stats.moderationEnabled}
                  description="Warn-System und Moderation"
                />
                <FeatureStatus
                  name="Geizhals Tracker"
                  enabled={currentGuild.stats.geizhalsEnabled}
                  description="Preisverfolgun für Hardware"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Warnings */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Neueste Warnungen
                  </h3>
                  <RecentWarnings guildId={selectedGuild} />
                </div>
              </div>

              {/* System Settings */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Schnelleinstellungen
                  </h3>
                  <QuickSettings guildId={selectedGuild} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'yellow' | 'red' | 'green';
}

function StatsCard({ title, value, icon, color }: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    red: 'bg-red-500 text-white',
    green: 'bg-green-500 text-white'
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-md ${colorClasses[color]}`}>
              {icon}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {value.toLocaleString()}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// Feature Status Component
interface FeatureStatusProps {
  name: string;
  enabled: boolean;
  description: string;
}

function FeatureStatus({ name, enabled, description }: FeatureStatusProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900">{name}</h4>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          enabled 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {enabled ? 'Aktiv' : 'Inaktiv'}
        </span>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

// Recent Warnings Component
function RecentWarnings({ guildId }: { guildId: string }) {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWarnings();
  }, [guildId]);

  const fetchWarnings = async () => {
    try {
      const response = await fetch(`/api/dashboard/warnings?guildId=${guildId}`);
      const data = await response.json();
      setWarnings(data);
    } catch (error) {
      console.error('Fehler beim Laden der Warnungen:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-20 bg-gray-200 rounded"></div>;
  }

  if (warnings.length === 0) {
    return <p className="text-gray-500">Keine Warnungen in den letzten 24 Stunden.</p>;
  }

  return (
    <div className="space-y-3">
      {warnings.slice(0, 5).map((warning: any) => (
        <div key={warning.id} className="flex items-center justify-between py-2 border-b">
          <div>
            <p className="text-sm font-medium text-gray-900">{warning.user.username}</p>
            <p className="text-sm text-gray-600 truncate">{warning.reason}</p>
          </div>
          <span className="text-xs text-gray-500">
            {new Date(warning.createdAt).toLocaleDateString('de-DE')}
          </span>
        </div>
      ))}
    </div>
  );
}

// Quick Settings Component
function QuickSettings({ guildId }: { guildId: string }) {
  const [settings, setSettings] = useState({
    enableLeveling: true,
    enableModeration: true,
    enableGeizhals: false
  });

  const updateSetting = async (key: string, value: boolean) => {
    try {
      const response = await fetch(`/api/dashboard/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guildId,
          [key]: value
        })
      });

      if (response.ok) {
        setSettings(prev => ({ ...prev, [key]: value }));
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Einstellungen:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Level System</h4>
          <p className="text-sm text-gray-600">XP und Leaderboards aktivieren</p>
        </div>
        <button
          onClick={() => updateSetting('enableLeveling', !settings.enableLeveling)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            settings.enableLeveling ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            settings.enableLeveling ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Moderation</h4>
          <p className="text-sm text-gray-600">Warn-System aktivieren</p>
        </div>
        <button
          onClick={() => updateSetting('enableModeration', !settings.enableModeration)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            settings.enableModeration ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            settings.enableModeration ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Geizhals Tracker</h4>
          <p className="text-sm text-gray-600">Preisverfolgun aktivieren</p>
        </div>
        <button
          onClick={() => updateSetting('enableGeizhals', !settings.enableGeizhals)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            settings.enableGeizhals ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            settings.enableGeizhals ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>
    </div>
  );
}