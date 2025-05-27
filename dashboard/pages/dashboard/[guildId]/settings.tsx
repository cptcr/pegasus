// dashboard/pages/settings.tsx
// This page seems like an alternative or older version of dashboard/[guildId]/settings.tsx
// Consider consolidating into the dynamic route if this is for guild-specific settings.
// If it's for global bot settings (not guild-specific), the API and data structure would differ.

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  CogIcon,
} from '@heroicons/react/24/outline';
import { ModernProtectedLayout } from '@/components/ModernProtectedLayout'; // Assuming this is the desired layout
import { GuildSettings as SharedGuildSettings, ApiChannel, ApiRole } from '@/types/index'; // Use shared types
import { toast } from 'sonner'; // For notifications

// Using a fixed GUILD_ID for this page if it's meant for a specific guild.
// Otherwise, this page might need a different approach (e.g., selecting a guild first).
const PAGE_GUILD_ID = process.env.NEXT_PUBLIC_TARGET_GUILD_ID || '554266392262737930';

interface SettingsPageProps {
  initialSettings: SharedGuildSettings | null;
  channels: ApiChannel[];
  roles: ApiRole[];
  error?: string;
}

// Helper function to safely get initial settings or defaults
const getInitialSettings = (settings: SharedGuildSettings | null): SharedGuildSettings => {
  const defaults: SharedGuildSettings = {
    prefix: '!',
    enableLeveling: true,
    enableModeration: true,
    enablePolls: true,
    enableGiveaways: true,
    enableTickets: false,
    enableGeizhals: false,
    enableAutomod: false,
    enableMusic: false,
    enableJoinToCreate: false,
    // Initialize other fields to null or default values
    logChannel: null,
    modLogChannel: null,
    quarantineRoleId: null,
    staffRoleId: null,
    welcomeChannel: null,
    levelUpChannelId: null,
    geizhalsChannelId: null,
    joinToCreateChannelId: null,
    joinToCreateCategoryId: null,
    welcomeMessage: "Welcome {user} to {server}!",
    goodbyeMessage: "{user} has left the server.",
  };
  return settings ? { ...defaults, ...settings } : defaults;
};


export default function SettingsPage({ initialSettings, channels, roles, error: initialError }: SettingsPageProps) {
  const router = useRouter();
  // State for settings, initialized with props or defaults
  const [settings, setSettings] = useState<SharedGuildSettings>(getInitialSettings(initialSettings));
  const [loading, setLoading] = useState(false); // For individual field updates
  const [, setPageError] = useState<string | undefined>(initialError);


  useEffect(() => {
    if (initialError) {
      toast.error(`Failed to load initial settings: ${initialError}`);
    }
  }, [initialError]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked; // For checkboxes/switches

    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (value === '' ? null : parseFloat(value)) : (value === '' ? null : value),
    }));
  };

  const handleToggleChange = (key: keyof SharedGuildSettings, enabled: boolean) => {
    setSettings(prev => ({
        ...prev,
        [key]: enabled,
    }));
    // Consider auto-saving or providing a save button
    saveSetting({ [key]: enabled });
  };

  const handleSelectChange = (key: keyof SharedGuildSettings, selectedValue: string | null) => {
     setSettings(prev => ({
        ...prev,
        [key]: selectedValue,
    }));
    saveSetting({ [key]: selectedValue });
  };


  const saveSetting = async (updatedSetting: Partial<SharedGuildSettings>) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/settings/${PAGE_GUILD_ID}`, { // Assuming API uses guildId
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSetting),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save setting');
      }
      const newSettings = await response.json();
      setSettings(prev => ({ ...prev, ...newSettings })); // Update local state with response
      toast.success('Setting saved successfully!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save setting.');
      // Optionally revert optimistic update or re-fetch settings
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
        const response = await fetch(`/api/dashboard/settings/${PAGE_GUILD_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save all settings');
        }
        const newSettings = await response.json();
        setSettings(newSettings);
        toast.success('All settings saved successfully!');
    } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
        setLoading(false);
    }
  };

  if (initialError && !initialSettings) {
    return (
      <ModernProtectedLayout>
        <div className="container p-4 mx-auto text-red-500">Error loading settings: {initialError}</div>
      </ModernProtectedLayout>
    );
  }


  return (
    <ModernProtectedLayout>
      <Head>
        <title>Bot Settings | Pegasus Dashboard</title>
      </Head>
      <div className="container p-4 mx-auto sm:p-6 lg:p-8">
        <div className="flex items-center mb-6">
          <CogIcon className="w-8 h-8 mr-3 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bot Settings</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* General Settings Section */}
          <section className="p-6 bg-white rounded-lg shadow dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-100">General Configuration</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="prefix" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Command Prefix</label>
                <input
                  type="text"
                  name="prefix"
                  id="prefix"
                  value={settings.prefix || ''}
                  onChange={handleInputChange}
                  onBlur={() => saveSetting({ prefix: settings.prefix })}
                  className="mt-1 input-field"
                  disabled={loading}
                />
              </div>
               {/* Example Toggle for a feature */}
              <div className="flex items-center justify-between pt-2">
                <div>
                    <label htmlFor="enableLeveling" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enable Leveling System</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enable or disable the XP and leveling system.</p>
                </div>
                <button
                    type="button"
                    onClick={() => handleToggleChange('enableLeveling', !settings.enableLeveling)}
                    className={`${settings.enableLeveling ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'} toggle-switch`}
                    disabled={loading}
                    aria-pressed={settings.enableLeveling}
                >
                    <span className={`${settings.enableLeveling ? 'translate-x-5' : 'translate-x-0'} toggle-switch-thumb`} />
                </button>
              </div>
            </div>
          </section>

          {/* Channel Settings Section */}
          <section className="p-6 bg-white rounded-lg shadow dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-100">Channel Configuration</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="modLogChannel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Moderation Log Channel</label>
                <select
                  name="modLogChannelId" // Ensure name matches state key
                  id="modLogChannelId"
                  value={settings.modLogChannelId || ''}
                  onChange={(e) => handleSelectChange('modLogChannelId', e.target.value || null)}
                  className="mt-1 select-field"
                  disabled={loading || channels.length === 0}
                >
                  <option value="">None</option>
                  {channels.filter(c => c.type === 0).map(channel => ( // Filter for text channels
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
              {/* Add more channel selectors here: welcomeChannel, levelUpChannelId, etc. */}
            </div>
          </section>


          {/* Role Settings Section */}
          <section className="p-6 bg-white rounded-lg shadow dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-100">Role Configuration</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                    <label htmlFor="quarantineRoleId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quarantine Role</label>
                    <select
                        name="quarantineRoleId"
                        id="quarantineRoleId"
                        value={settings.quarantineRoleId || ''}
                        onChange={(e) => handleSelectChange('quarantineRoleId', e.target.value || null)}
                        className="mt-1 select-field"
                        disabled={loading || roles.length === 0}
                    >
                        <option value="">None</option>
                        {roles.filter(r => !r.managed).map(role => ( // Filter out managed roles
                            <option key={role.id} value={role.id} style={{ color: `#${role.color.toString(16).padStart(6, '0')}`}}>
                                @{role.name}
                            </option>
                        ))}
                    </select>
                </div>
                 {/* Add more role selectors here: staffRoleId, autorole, etc. */}
            </div>
          </section>


          <div className="flex justify-end mt-8">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
        </form>
      </div>
    </ModernProtectedLayout>
  );
}

export const getServerSideProps: GetServerSideProps<SettingsPageProps> = async (context) => {
  // This getServerSideProps is more suited for the dynamic `dashboard/[guildId]/settings.tsx` page.
  // For a static `/settings` page, you might fetch global settings or redirect.
  // For demonstration, assuming it fetches for a predefined guildId or errors out.

  const session = await getSession(context);
  if (!session?.user) { // Basic session check
    return { redirect: { destination: '/auth/signin', permanent: false } };
  }
  // Add hasRequiredAccess check if needed for this specific page globally
  // if (!(session.user as any).hasRequiredAccess) {
  //   return { redirect: { destination: '/auth/error?error=AccessDenied', permanent: false }, props: {} };
  // }


  const guildId = PAGE_GUILD_ID; // Using the predefined guild ID for this static page.

  try {
    // Fetching data from your API routes
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001'; // Ensure this is correct for server-side
    const [settingsRes, channelsRes, rolesRes] = await Promise.all([
      fetch(`${baseUrl}/api/dashboard/settings/${guildId}`), // Assuming this API exists and works
      fetch(`${baseUrl}/api/dashboard/channels/${guildId}`),
      fetch(`${baseUrl}/api/dashboard/roles/${guildId}`),
    ]);

    if (!settingsRes.ok) throw new Error(`Failed to fetch settings: ${settingsRes.statusText}`);
    if (!channelsRes.ok) throw new Error(`Failed to fetch channels: ${channelsRes.statusText}`);
    if (!rolesRes.ok) throw new Error(`Failed to fetch roles: ${rolesRes.statusText}`);

    const initialSettings: SharedGuildSettings = await settingsRes.json();
    const channels: ApiChannel[] = await channelsRes.json();
    const roles: ApiRole[] = await rolesRes.json();

    return { props: { initialSettings, channels, roles } };
  } catch (error: unknown) {
    console.error("Error in getServerSideProps for settings page:", error);
    return { props: { initialSettings: null, channels: [], roles: [], error: error instanceof Error ? error.message : "Failed to load initial page data." } };
  }
};