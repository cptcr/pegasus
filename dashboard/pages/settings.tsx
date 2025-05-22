import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  CogIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  GiftIcon,
  TicketIcon,
  CommandLineIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface GuildSettings {
  id: string;
  name: string;
  prefix: string;
  modLogChannelId?: string;
  levelUpChannelId?: string;
  quarantineRoleId?: string;
  geizhalsChannelId?: string;
  welcomeChannelId?: string;
  enableLeveling: boolean;
  enableModeration: boolean;
  enableGeizhals: boolean;
  enablePolls: boolean;
  enableGiveaways: boolean;
  enableAutomod: boolean;
  enableTickets: boolean;
  enableMusic: boolean;
  welcomeMessage?: string;
  leaveMessage?: string;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface Role {
  id: string;
  name: string;
  color: number;
}

interface SettingsProps {
  guild: GuildSettings;
  channels: Channel[];
  roles: Role[];
}

export default function Settings({ guild, channels, roles }: SettingsProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<GuildSettings>(guild);
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const textChannels = channels.filter(ch => ch.type === 0);
  const categories = channels.filter(ch => ch.type === 4);

  const handleToggle = async (key: keyof GuildSettings, value: boolean) => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guildId: guild.id,
          [key]: value
        })
      });

      if (response.ok) {
        setSettings(prev => ({ ...prev, [key]: value }));
        showSavedMessage();
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChannelChange = async (key: keyof GuildSettings, channelId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guildId: guild.id,
          [key]: channelId || null
        })
      });

      if (response.ok) {
        setSettings(prev => ({ ...prev, [key]: channelId }));
        showSavedMessage();
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (key: keyof GuildSettings, roleId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guildId: guild.id,
          [key]: roleId || null
        })
      });

      if (response.ok) {
        setSettings(prev => ({ ...prev, [key]: roleId }));
        showSavedMessage();
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = async (key: keyof GuildSettings, value: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guildId: guild.id,
          [key]: value || null
        })
      });

      if (response.ok) {
        setSettings(prev => ({ ...prev, [key]: value }));
        showSavedMessage();
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    } finally {
      setLoading(false);
    }
  };

  const showSavedMessage = () => {
    setSavedMessage('Einstellungen gespeichert!');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Einstellungen - {guild.name} | Hinko Bot Dashboard</title>
      </Head>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 rounded-md text-gray-400 hover:text-gray-500"
              >
                ← Zurück
              </button>
              <CogIcon className="h-6 w-6 text-gray-400 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Einstellungen - {guild.name}
              </h1>
            </div>
            
            {savedMessage && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded">
                {savedMessage}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          
          {/* Basis-Einstellungen */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Basis-Einstellungen</h3>
              <p className="text-sm text-gray-600">Grundlegende Bot-Konfiguration</p>
            </div>
            <div className="px-6 py-4 space-y-6">
              
              {/* Prefix */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Command Prefix
                </label>
                <input
                  type="text"
                  value={settings.prefix}
                  onChange={(e) => setSettings(prev => ({ ...prev, prefix: e.target.value }))}
                  onBlur={(e) => handleTextChange('prefix', e.target.value)}
                  className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="!"
                />
                <p className="text-xs text-gray-500 mt-1">Standard Prefix für Bot-Commands</p>
              </div>

              {/* Welcome Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Willkommensnachricht
                </label>
                <textarea
                  value={settings.welcomeMessage || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                  onBlur={(e) => handleTextChange('welcomeMessage', e.target.value)}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Willkommen {user} auf unserem Server!"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Verfügbare Platzhalter: {'{user}'}, {'{server}'}, {'{membercount}'}
                </p>
              </div>

              {/* Leave Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verlassen-Nachricht
                </label>
                <textarea
                  value={settings.leaveMessage || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, leaveMessage: e.target.value }))}
                  onBlur={(e) => handleTextChange('leaveMessage', e.target.value)}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="{user} hat den Server verlassen."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Verfügbare Platzhalter: {'{user}'}, {'{server}'}
                </p>
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Features</h3>
              <p className="text-sm text-gray-600">Bot-Features aktivieren oder deaktivieren</p>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <FeatureToggle
                  icon={<ChartBarIcon className="h-5 w-5" />}
                  title="Level System"
                  description="XP-System und Leaderboards"
                  enabled={settings.enableLeveling}
                  onChange={(value) => handleToggle('enableLeveling', value)}
                  loading={loading}
                />

                <FeatureToggle
                  icon={<ShieldCheckIcon className="h-5 w-5" />}
                  title="Moderation"
                  description="Warn-System und Quarantäne"
                  enabled={settings.enableModeration}
                  onChange={(value) => handleToggle('enableModeration', value)}
                  loading={loading}
                />

                <FeatureToggle
                  icon={<BellIcon className="h-5 w-5" />}
                  title="Geizhals Tracker"
                  description="Preisverfolgun für Hardware"
                  enabled={settings.enableGeizhals}
                  onChange={(value) => handleToggle('enableGeizhals', value)}
                  loading={loading}
                />

                <FeatureToggle
                  icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
                  title="Umfragen"
                  description="Community Abstimmungen"
                  enabled={settings.enablePolls}
                  onChange={(value) => handleToggle('enablePolls', value)}
                  loading={loading}
                />

                <FeatureToggle
                  icon={<GiftIcon className="h-5 w-5" />}
                  title="Giveaways"
                  description="Gewinnspiele und Verlosungen"
                  enabled={settings.enableGiveaways}
                  onChange={(value) => handleToggle('enableGiveaways', value)}
                  loading={loading}
                />

                <FeatureToggle
                  icon={<ExclamationTriangleIcon className="h-5 w-5" />}
                  title="Automod"
                  description="Automatische Moderation"
                  enabled={settings.enableAutomod}
                  onChange={(value) => handleToggle('enableAutomod', value)}
                  loading={loading}
                />

                <FeatureToggle
                  icon={<TicketIcon className="h-5 w-5" />}
                  title="Ticket System"
                  description="Support-Tickets"
                  enabled={settings.enableTickets}
                  onChange={(value) => handleToggle('enableTickets', value)}
                  loading={loading}
                />

                <FeatureToggle
                  icon={<CommandLineIcon className="h-5 w-5" />}
                  title="Musik Bot"
                  description="Musik-Wiedergabe"
                  enabled={settings.enableMusic}
                  onChange={(value) => handleToggle('enableMusic', value)}
                  loading={loading}
                />
              </div>
            </div>
          </div>

          {/* Channel-Konfiguration */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Channel-Konfiguration</h3>
              <p className="text-sm text-gray-600">Channels für verschiedene Bot-Features</p>
            </div>
            <div className="px-6 py-4 space-y-6">
              
              <ChannelSelector
                label="Moderations-Log Channel"
                description="Channel für Moderations-Logs"
                value={settings.modLogChannelId || ''}
                onChange={(value) => handleChannelChange('modLogChannelId', value)}
                channels={textChannels}
                loading={loading}
              />

              <ChannelSelector
                label="Level-Up Channel"
                description="Channel für Level-Up Benachrichtigungen"
                value={settings.levelUpChannelId || ''}
                onChange={(value) => handleChannelChange('levelUpChannelId', value)}
                channels={textChannels}
                loading={loading}
              />

              <ChannelSelector
                label="Geizhals Channel"
                description="Channel für Preisalarme"
                value={settings.geizhalsChannelId || ''}
                onChange={(value) => handleChannelChange('geizhalsChannelId', value)}
                channels={textChannels}
                loading={loading}
              />

              <ChannelSelector
                label="Willkommens-Channel"
                description="Channel für Willkommens- und Verlassen-Nachrichten"
                value={settings.welcomeChannelId || ''}
                onChange={(value) => handleChannelChange('welcomeChannelId', value)}
                channels={textChannels}
                loading={loading}
              />
            </div>
          </div>

          {/* Rollen-Konfiguration */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Rollen-Konfiguration</h3>
              <p className="text-sm text-gray-600">Rollen für verschiedene Bot-Features</p>
            </div>
            <div className="px-6 py-4 space-y-6">
              
              <RoleSelector
                label="Quarantäne-Rolle"
                description="Rolle für Benutzer in Quarantäne"
                value={settings.quarantineRoleId || ''}
                onChange={(value) => handleRoleChange('quarantineRoleId', value)}
                roles={roles}
                loading={loading}
              />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// Feature Toggle Component
interface FeatureToggleProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  loading: boolean;
}

function FeatureToggle({ icon, title, description, enabled, onChange, loading }: FeatureToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-md ${enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          enabled ? 'bg-indigo-600' : 'bg-gray-200'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  );
}

// Channel Selector Component
interface ChannelSelectorProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  channels: Channel[];
  loading: boolean;
}

function ChannelSelector({ label, description, value, onChange, channels, loading }: ChannelSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
      >
        <option value="">Kein Channel ausgewählt</option>
        {channels.map(channel => (
          <option key={channel.id} value={channel.id}>
            # {channel.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}

// Role Selector Component
interface RoleSelectorProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  roles: Role[];
  loading: boolean;
}

function RoleSelector({ label, description, value, onChange, roles, loading }: RoleSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
      >
        <option value="">Keine Rolle ausgewählt</option>
        {roles.map(role => (
          <option key={role.id} value={role.id}>
            @{role.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}

// Server-side props mit Zugriffsschutz
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { guild: guildId } = context.query;
  
  // Zugriffsschutz (gleicher Code wie in index.tsx)
  const ALLOWED_USER_ID = '797927858420187186';
  const TARGET_GUILD_ID = '554266392262737930';
  
  try {
    // Guild-Daten laden
    const guildResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/dashboard/guild?id=${guildId}`);
    const guildData = await guildResponse.json();
    
    // Channels und Rollen laden
    const channelsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/dashboard/channels?guildId=${guildId}`);
    const channels = await channelsResponse.json();
    
    const rolesResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/dashboard/roles?guildId=${guildId}`);
    const roles = await rolesResponse.json();

    return {
      props: {
        guild: guildData,
        channels,
        roles,
      },
    };
  } catch (error) {
    return {
      notFound: true,
    };
  }
};