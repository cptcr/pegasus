// dashboard/pages/dashboard/[guildId]/settings.tsx
import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
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
  ExclamationTriangleIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  ChevronLeftIcon,
  CheckIcon,
  XMarkIcon
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
  joinToCreateChannelId?: string;
  joinToCreateCategoryId?: string;
  enableLeveling: boolean;
  enableModeration: boolean;
  enableGeizhals: boolean;
  enablePolls: boolean;
  enableGiveaways: boolean;
  enableAutomod: boolean;
  enableTickets: boolean;
  enableMusic: boolean;
  enableJoinToCreate: boolean;
  welcomeMessage?: string;
  leaveMessage?: string;
}

interface Channel {
  id: string;
  name: string;
  type: number;
  parentId?: string;
}

interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
}

export default function Settings() {
  const router = useRouter();
  const { guildId } = router.query;
  const [settings, setSettings] = useState<GuildSettings | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guildId && typeof guildId === 'string') {
      fetchSettingsData(guildId);
    }
  }, [guildId]);

  const fetchSettingsData = async (id: string) => {
    try {
      setLoading(true);
      const [settingsResponse, channelsResponse, rolesResponse] = await Promise.all([
        fetch(`/api/dashboard/settings/${id}`),
        fetch(`/api/dashboard/channels/${id}`),
        fetch(`/api/dashboard/roles/${id}`)
      ]);
      
      if (!settingsResponse.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const settingsData = await settingsResponse.json();
      setSettings(settingsData);

      if (channelsResponse.ok) {
        const channelsData = await channelsResponse.json();
        setChannels(channelsData);
      }

      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setRoles(rolesData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<GuildSettings>) => {
    if (!settings || !guildId) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/dashboard/settings/${guildId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const updatedSettings = await response.json();
      setSettings(updatedSettings);
      showSavedMessage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (key: keyof GuildSettings, value: boolean) => {
    await updateSettings({ [key]: value });
  };

  const handleTextChange = async (key: keyof GuildSettings, value: string) => {
    await updateSettings({ [key]: value || null });
  };

  const showSavedMessage = () => {
    setSavedMessage('Settings saved!');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600">{error || 'Settings not found'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const textChannels = channels.filter(ch => ch.type === 0);
  const voiceChannels = channels.filter(ch => ch.type === 2);
  const categories = channels.filter(ch => ch.type === 4);

  const tabs = [
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'features', name: 'Features', icon: ChartBarIcon },
    { id: 'channels', name: 'Channels', icon: ChatBubbleLeftRightIcon },
    { id: 'moderation', name: 'Moderation', icon: ShieldCheckIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Settings - {settings.name} | Hinko Bot Dashboard</title>
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
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <CogIcon className="h-6 w-6 text-gray-400 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Settings - {settings.name}
              </h1>
            </div>
            
            {savedMessage && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded flex items-center">
                <CheckIcon className="h-4 w-4 mr-2" />
                {savedMessage}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-8">
          
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Basic Settings</h3>
                <p className="text-sm text-gray-600">Basic bot configuration</p>
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
                    onChange={(e) => setSettings(prev => prev ? { ...prev, prefix: e.target.value } : null)}
                    onBlur={(e) => handleTextChange('prefix', e.target.value)}
                    className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="!"
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 mt-1">Default prefix for bot commands</p>
                </div>

                {/* Welcome Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Welcome Message
                  </label>
                  <textarea
                    value={settings.welcomeMessage || ''}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, welcomeMessage: e.target.value } : null)}
                    onBlur={(e) => handleTextChange('welcomeMessage', e.target.value)}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Welcome {user} to our server!"
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Available placeholders: {'{user}'}, {'{server}'}, {'{membercount}'}
                  </p>
                </div>

                {/* Leave Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Message
                  </label>
                  <textarea
                    value={settings.leaveMessage || ''}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, leaveMessage: e.target.value } : null)}
                    onBlur={(e) => handleTextChange('leaveMessage', e.target.value)}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="{user} has left the server."
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Available placeholders: {'{user}'}, {'{server}'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feature Toggles */}
          {activeTab === 'features' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Features</h3>
                <p className="text-sm text-gray-600">Enable or disable bot features</p>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  
                  <FeatureToggle
                    icon={<ChartBarIcon className="h-5 w-5" />}
                    title="Level System"
                    description="XP system and leaderboards"
                    enabled={settings.enableLeveling}
                    onChange={(value) => handleToggle('enableLeveling', value)}
                    loading={saving}
                  />

                  <FeatureToggle
                    icon={<ShieldCheckIcon className="h-5 w-5" />}
                    title="Moderation"
                    description="Warning system and quarantine"
                    enabled={settings.enableModeration}
                    onChange={(value) => handleToggle('enableModeration', value)}
                    loading={saving}
                  />

                  <FeatureToggle
                    icon={<BellIcon className="h-5 w-5" />}
                    title="Geizhals Tracker"
                    description="Price tracking for hardware"
                    enabled={settings.enableGeizhals}
                    onChange={(value) => handleToggle('enableGeizhals', value)}
                    loading={saving}
                  />

                  <FeatureToggle
                    icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
                    title="Polls"
                    description="Community voting"
                    enabled={settings.enablePolls}
                    onChange={(value) => handleToggle('enablePolls', value)}
                    loading={saving}
                  />

                  <FeatureToggle
                    icon={<GiftIcon className="h-5 w-5" />}
                    title="Giveaways"
                    description="Contests and giveaways"
                    enabled={settings.enableGiveaways}
                    onChange={(value) => handleToggle('enableGiveaways', value)}
                    loading={saving}
                  />

                  <FeatureToggle
                    icon={<ExclamationTriangleIcon className="h-5 w-5" />}
                    title="Automod"
                    description="Automatic moderation"
                    enabled={settings.enableAutomod}
                    onChange={(value) => handleToggle('enableAutomod', value)}
                    loading={saving}
                  />

                  <FeatureToggle
                    icon={<TicketIcon className="h-5 w-5" />}
                    title="Ticket System"
                    description="Support tickets"
                    enabled={settings.enableTickets}
                    onChange={(value) => handleToggle('enableTickets', value)}
                    loading={saving}
                  />

                  <FeatureToggle
                    icon={<MusicalNoteIcon className="h-5 w-5" />}
                    title="Music Bot"
                    description="Music playback"
                    enabled={settings.enableMusic}
                    onChange={(value) => handleToggle('enableMusic', value)}
                    loading={saving}
                  />

                  <FeatureToggle
                    icon={<MicrophoneIcon className="h-5 w-5" />}
                    title="Join-To-Create"
                    description="Temporary voice channels"
                    enabled={settings.enableJoinToCreate}
                    onChange={(value) => handleToggle('enableJoinToCreate', value)}
                    loading={saving}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Channel Configuration */}
          {activeTab === 'channels' && (
            <div className="space-y-6">
              {/* Text Channels */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Channel Configuration</h3>
                  <p className="text-sm text-gray-600">Configure channels for various bot features</p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  
                  <ChannelSelector
                    label="Moderation Log Channel"
                    description="Channel for moderation logs"
                    value={settings.modLogChannelId || ''}
                    onChange={(value) => handleTextChange('modLogChannelId', value)}
                    channels={textChannels}
                    loading={saving}
                  />

                  <ChannelSelector
                    label="Level-Up Channel"
                    description="Channel for level-up notifications"
                    value={settings.levelUpChannelId || ''}
                    onChange={(value) => handleTextChange('levelUpChannelId', value)}
                    channels={textChannels}
                    loading={saving}
                  />

                  <ChannelSelector
                    label="Geizhals Channel"
                    description="Channel for price alerts"
                    value={settings.geizhalsChannelId || ''}
                    onChange={(value) => handleTextChange('geizhalsChannelId', value)}
                    channels={textChannels}
                    loading={saving}
                  />

                  <ChannelSelector
                    label="Welcome Channel"
                    description="Channel for welcome and leave messages"
                    value={settings.welcomeChannelId || ''}
                    onChange={(value) => handleTextChange('welcomeChannelId', value)}
                    channels={textChannels}
                    loading={saving}
                  />

                  <ChannelSelector
                    label="Join-To-Create Trigger Channel"
                    description="Voice channel that creates temporary channels"
                    value={settings.joinToCreateChannelId || ''}
                    onChange={(value) => handleTextChange('joinToCreateChannelId', value)}
                    channels={voiceChannels}
                    loading={saving}
                  />

                  <ChannelSelector
                    label="Join-To-Create Category"
                    description="Category for temporary voice channels"
                    value={settings.joinToCreateCategoryId || ''}
                    onChange={(value) => handleTextChange('joinToCreateCategoryId', value)}
                    channels={categories}
                    loading={saving}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Moderation Settings */}
          {activeTab === 'moderation' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Moderation Configuration</h3>
                <p className="text-sm text-gray-600">Configure moderation settings and roles</p>
              </div>
              <div className="px-6 py-4 space-y-6">
                
                <RoleSelector
                  label="Quarantine Role"
                  description="Role for users in quarantine"
                  value={settings.quarantineRoleId || ''}
                  onChange={(value) => handleTextChange('quarantineRoleId', value)}
                  roles={roles}
                  loading={saving}
                />

                {/* Moderation Features Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Warning System</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {settings.enableModeration ? '✅ Active' : '❌ Disabled'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Use <code>/warn</code> commands to manage warnings
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Automod System</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {settings.enableAutomod ? '✅ Active' : '❌ Disabled'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Use <code>/automod setup</code> to configure
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Quarantine System</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {settings.enableModeration && settings.quarantineRoleId ? '✅ Configured' : '⚠️ Needs Setup'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Use <code>/quarantine setup</code> to configure
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900">Ticket System</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {settings.enableTickets ? '✅ Active' : '❌ Disabled'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Use <code>/ticket setup</code> to configure categories
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Management Actions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => router.push(`/dashboard/${guildId}/moderation`)}
                      className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <ShieldCheckIcon className="h-4 w-4 mr-2" />
                      View Moderation
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/${guildId}/levels`)}
                      className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <ChartBarIcon className="h-4 w-4 mr-2" />
                      Level System
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/${guildId}`)}
                      className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <CogIcon className="h-4 w-4 mr-2" />
                      Dashboard
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

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

interface ChannelSelectorProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  channels: Channel[];
  loading: boolean;
}

function ChannelSelector({ label, description, value, onChange, channels, loading }: ChannelSelectorProps) {
  const getChannelPrefix = (type: number) => {
    switch (type) {
      case 0: return '#'; // Text Channel
      case 2: return '🔊'; // Voice Channel
      case 4: return '📁'; // Category
      default: return '';
    }
  };

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
        <option value="">No channel selected</option>
        {channels.map(channel => (
          <option key={channel.id} value={channel.id}>
            {getChannelPrefix(channel.type)} {channel.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}

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
        <option value="">No role selected</option>
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
};// dashboard/components/ProtectedLayout.tsx
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ShieldCheckIcon, ArrowRightOnRectangleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ProtectedLayoutProps {
  children: React.ReactNode;
  requiredGuildId?: string;
}

const ALLOWED_GUILD_ID = '554266392262737930';
const REQUIRED_ROLE_ID = '797927858420187186';

export default function ProtectedLayout({ 
  children, 
  requiredGuildId = ALLOWED_GUILD_ID 
}: ProtectedLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Check if user has required access (guild membership + role)
    if (session.user?.hasRequiredAccess !== true) {
      console.log('Access denied - redirecting to error page');
      router.push('/auth/error?error=AccessDenied');
      return;
    }

    setIsAuthorized(true);
    setIsLoading(false);
  }, [session, status, router, requiredGuildId]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
          <p className="text-sm text-gray-500">Checking guild membership and permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">
                Hinko Dashboard
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {session?.user?.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${session.user.id}/${session.user.avatar}.png`}
                    alt="Avatar"
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700">
                  {session?.user?.username}#{session?.user?.discriminator}
                </span>
              </div>
              
              <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                Authorized
              </div>
              
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 transition-colors"
                title="Sign Out"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span className="text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Hinko Bot Dashboard v2.0.0 - Guild: {requiredGuildId} - Role: {REQUIRED_ROLE_ID}
            </div>
            <div className="text-sm text-gray-500">
              Authorized access only
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}