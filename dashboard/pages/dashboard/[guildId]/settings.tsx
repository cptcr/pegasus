// dashboard/pages/dashboard/[guildId]/settings.tsx
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
  ExclamationTriangleIcon,
  MicrophoneIcon,
  MusicalNoteIcon
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

export default function Settings() {
  const router = useRouter();
  const { guildId } = router.query;
  const [settings, setSettings] = useState<GuildSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guildId && typeof guildId === 'string') {
      fetchSettings(guildId);
    }
  }, [guildId]);

  const fetchSettings = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/settings/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      
      const data = await response.json();
      setSettings(data);
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

  const tabs = [
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'features', name: 'Features', icon: ChartBarIcon },
    { id: 'moderation', name: 'Moderation', icon: ShieldCheckIcon },
    { id: 'community', name: 'Community', icon: GiftIcon },
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
                ← Back
              </button>
              <CogIcon className="h-6 w-6 text-gray-400 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Settings - {settings.name}
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

          {/* Moderation Settings */}
          {activeTab === 'moderation' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Moderation Configuration</h3>
                <p className="text-sm text-gray-600">Configure moderation settings</p>
              </div>
              <div className="px-6 py-4 space-y-6">
                
                {/* Automod Status */}
                {settings.enableAutomod && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Automod System Active</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Use <code className="bg-blue-100 px-1 rounded">/automod setup</code> to configure the system.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                    <h4 className="font-medium text-gray-900">Quarantine System</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {settings.enableModeration ? '✅ Available' : '❌ Disabled'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Use <code>/quarantine setup</code> to configure
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Community Settings */}
          {activeTab === 'community' && (
            <div className="space-y-6">
              {/* Poll Settings */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Poll Settings</h3>
                  <p className="text-sm text-gray-600">Configuration for the poll system</p>
                </div>
                <div className="px-6 py-4">
                  {settings.enablePolls ? (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                          <div>
                            <h4 className="text-sm font-medium text-green-900">Polls Enabled</h4>
                            <p className="text-sm text-green-700 mt-1">
                              Users can use <code className="bg-green-100 px-1 rounded">/poll create</code> to create polls.
                            </p>
                            <div className="mt-3 text-sm text-green-700">
                              <strong>Features:</strong>
                              <ul className="mt-1 list-disc list-inside space-y-1">
                                <li>Multiple choice options</li>
                                <li>Anonymous voting</li>
                                <li>Timed polls</li>
                                <li>Interactive buttons</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        Polls are disabled. Enable the feature to create polls.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Giveaway Settings */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Giveaway Settings</h3>
                  <p className="text-sm text-gray-600">Configuration for the giveaway system</p>
                </div>
                <div className="px-6 py-4">
                  {settings.enableGiveaways ? (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <GiftIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                          <div>
                            <h4 className="text-sm font-medium text-green-900">Giveaways Enabled</h4>
                            <p className="text-sm text-green-700 mt-1">
                              Moderators can use <code className="bg-green-100 px-1 rounded">/giveaway create</code>.
                            </p>
                            <div className="mt-3 text-sm text-green-700">
                              <strong>Features:</strong>
                              <ul className="mt-1 list-disc list-inside space-y-1">
                                <li>Automatic winner selection</li>
                                <li>Entry requirements (role, level)</li>
                                <li>Multiple winners</li>
                                <li>Reroll functionality</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        Giveaways are disabled. Enable the feature to create giveaways.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ticket Settings */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Ticket System</h3>
                  <p className="text-sm text-gray-600">Support ticket configuration</p>
                </div>
                <div className="px-6 py-4">
                  {settings.enableTickets ? (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <TicketIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                          <div>
                            <h4 className="text-sm font-medium text-green-900">Ticket System Enabled</h4>
                            <p className="text-sm text-green-700 mt-1">
                              Use <code className="bg-green-100 px-1 rounded">/ticket setup</code> to configure the system.
                            </p>
                            <div className="mt-3 text-sm text-green-700">
                              <strong>Features:</strong>
                              <ul className="mt-1 list-disc list-inside space-y-1">
                                <li>Categorized tickets</li>
                                <li>Priority system</li>
                                <li>Moderator assignment</li>
                                <li>Automatic archiving</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        Ticket system is disabled. Enable the feature to allow support tickets.
                      </p>
                    </div>
                  )}
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  return { props: {} };
};