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
  const [activeTab, setActiveTab] = useState('general');

  const textChannels = channels.filter(ch => ch.type === 0);
  const voiceChannels = channels.filter(ch => ch.type === 2);
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

  const tabs = [
    { id: 'general', name: 'Allgemein', icon: CogIcon },
    { id: 'features', name: 'Features', icon: ChartBarIcon },
    { id: 'channels', name: 'Channels', icon: ChatBubbleLeftRightIcon },
    { id: 'moderation', name: 'Moderation', icon: ShieldCheckIcon },
    { id: 'community', name: 'Community', icon: GiftIcon },
  ];

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
          
          {/* Allgemeine Einstellungen */}
          {activeTab === 'general' && (
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
                    disabled={loading}
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
                    disabled={loading}
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
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Verfügbare Platzhalter: {'{user}'}, {'{server}'}
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
                <p className="text-sm text-gray-600">Bot-Features aktivieren oder deaktivieren</p>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  
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
                    icon={<MusicalNoteIcon className="h-5 w-5" />}
                    title="Musik Bot"
                    description="Musik-Wiedergabe"
                    enabled={settings.enableMusic}
                    onChange={(value) => handleToggle('enableMusic', value)}
                    loading={loading}
                  />

                  <FeatureToggle
                    icon={<MicrophoneIcon className="h-5 w-5" />}
                    title="Join-To-Create"
                    description="Temporäre Voice Channels"
                    enabled={settings.enableJoinToCreate}
                    onChange={(value) => handleToggle('enableJoinToCreate', value)}
                    loading={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Channel-Konfiguration */}
          {activeTab === 'channels' && (
            <div className="space-y-6">
              {/* Text Channels */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Text Channel Konfiguration</h3>
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

              {/* Voice Channels & Categories */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Voice Channel Konfiguration</h3>
                  <p className="text-sm text-gray-600">Voice Channels und Kategorien für spezielle Features</p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  
                  <ChannelSelector
                    label="Join-To-Create Trigger Channel"
                    description="Voice Channel der temporäre Channels erstellt"
                    value={settings.joinToCreateChannelId || ''}
                    onChange={(value) => handleChannelChange('joinToCreateChannelId', value)}
                    channels={voiceChannels}
                    loading={loading}
                  />

                  <ChannelSelector
                    label="Join-To-Create Kategorie"
                    description="Kategorie für temporäre Voice Channels"
                    value={settings.joinToCreateCategoryId || ''}
                    onChange={(value) => handleChannelChange('joinToCreateCategoryId', value)}
                    channels={categories}
                    loading={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Moderation Settings */}
          {activeTab === 'moderation' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Moderations-Konfiguration</h3>
                <p className="text-sm text-gray-600">Rollen und Einstellungen für Moderation</p>
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

                {/* Automod Settings Preview */}
                {settings.enableAutomod && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Automod System aktiviert</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Verwende <code className="bg-blue-100 px-1 rounded">/automod setup</code> um das System zu konfigurieren.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Community Settings */}
          {activeTab === 'community' && (
            <div className="space-y-6">
              {/* Poll Settings */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Umfragen-Einstellungen</h3>
                  <p className="text-sm text-gray-600">Konfiguration für das Umfrage-System</p>
                </div>
                <div className="px-6 py-4">
                  {settings.enablePolls ? (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                          <div>
                            <h4 className="text-sm font-medium text-green-900">Umfragen aktiviert</h4>
                            <p className="text-sm text-green-700 mt-1">
                              Benutzer können <code className="bg-green-100 px-1 rounded">/poll create</code> verwenden um Umfragen zu erstellen.
                            </p>
                            <div className="mt-3 text-sm text-green-700">
                              <strong>Features:</strong>
                              <ul className="mt-1 list-disc list-inside space-y-1">
                                <li>Mehrfachauswahl möglich</li>
                                <li>Anonyme Abstimmungen</li>
                                <li>Zeitgesteuerte Umfragen</li>
                                <li>Interaktive Buttons</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        Umfragen sind deaktiviert. Aktiviere das Feature um Umfragen zu erstellen.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Giveaway Settings */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Giveaway-Einstellungen</h3>
                  <p className="text-sm text-gray-600">Konfiguration für das Giveaway-System</p>
                </div>
                <div className="px-6 py-4">
                  {settings.enableGiveaways ? (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <GiftIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                          <div>
                            <h4 className="text-sm font-medium text-green-900">Giveaways aktiviert</h4>
                            <p className="text-sm text-green-700 mt-1">
                              Moderatoren können <code className="bg-green-100 px-1 rounded">/giveaway create</code> verwenden.
                            </p>
                            <div className="mt-3 text-sm text-green-700">
                              <strong>Features:</strong>
                              <ul className="mt-1 list-disc list-inside space-y-1">
                                <li>Automatische Gewinner-Auslosung</li>
                                <li>Teilnahme-Voraussetzungen (Rolle, Level)</li>
                                <li>Mehrere Gewinner möglich</li>
                                <li>Reroll-Funktion</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        Giveaways sind deaktiviert. Aktiviere das Feature um Gewinnspiele zu erstellen.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ticket Settings */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Ticket-System</h3>
                  <p className="text-sm text-gray-600">Support-Ticket Konfiguration</p>
                </div>
                <div className="px-6 py-4">
                  {settings.enableTickets ? (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <TicketIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                          <div>
                            <h4 className="text-sm font-medium text-green-900">Ticket-System aktiviert</h4>
                            <p className="text-sm text-green-700 mt-1">
                              Verwende <code className="bg-green-100 px-1 rounded">/ticket setup</code> um das System einzurichten.
                            </p>
                            <div className="mt-3 text-sm text-green-700">
                              <strong>Features:</strong>
                              <ul className="mt-1 list-disc list-inside space-y-1">
                                <li>Kategorisierte Tickets</li>
                                <li>Prioritäts-System</li>
                                <li>Moderator-Zuweisung</li>
                                <li>Automatische Archivierung</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        Ticket-System ist deaktiviert. Aktiviere das Feature um Support-Tickets zu ermöglichen.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Join-To-Create Settings */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Join-To-Create System</h3>
                  <p className="text-sm text-gray-600">Temporäre Voice Channel Erstellung</p>
                </div>
                <div className="px-6 py-4">
                  {settings.enableJoinToCreate ? (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <MicrophoneIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                          <div>
                            <h4 className="text-sm font-medium text-green-900">Join-To-Create aktiviert</h4>
                            <p className="text-sm text-green-700 mt-1">
                              Verwende <code className="bg-green-100 px-1 rounded">/jointocreate setup</code> um Trigger-Channel zu konfigurieren.
                            </p>
                            <div className="mt-3 text-sm text-green-700">
                              <strong>Features:</strong>
                              <ul className="mt-1 list-disc list-inside space-y-1">
                                <li>Automatische Channel-Erstellung</li>
                                <li>Benutzer-Berechtigung für eigene Channels</li>
                                <li>Automatisches Löschen leerer Channels</li>
                                <li>Kategorien-Organisation</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Current Configuration */}
                      {(settings.joinToCreateChannelId || settings.joinToCreateCategoryId) && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h5 className="text-sm font-medium text-blue-900 mb-2">Aktuelle Konfiguration:</h5>
                          <div className="text-sm text-blue-700 space-y-1">
                            {settings.joinToCreateChannelId && (
                              <div>
                                <strong>Trigger Channel:</strong> #{channels.find(c => c.id === settings.joinToCreateChannelId)?.name || 'Unbekannt'}
                              </div>
                            )}
                            {settings.joinToCreateCategoryId && (
                              <div>
                                <strong>Kategorie:</strong> {channels.find(c => c.id === settings.joinToCreateCategoryId)?.name || 'Unbekannt'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        Join-To-Create ist deaktiviert. Aktiviere das Feature um temporäre Voice Channels zu ermöglichen.
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
        <option value="">Kein Channel ausgewählt</option>
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