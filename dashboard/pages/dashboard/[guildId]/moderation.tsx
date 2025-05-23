// dashboard/pages/dashboard/[guildId]/moderation.tsx
import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  ClockIcon,
  XMarkIcon,
  CheckIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline';

interface Warning {
  id: number;
  userId: string;
  reason: string;
  active: boolean;
  createdAt: string;
  user: {
    id: string;
    username: string;
  };
  moderator: {
    id: string;
    username: string;
  };
}

interface QuarantineEntry {
  id: number;
  targetId: string;
  targetType: 'USER' | 'CHANNEL' | 'ROLE';
  reason: string;
  active: boolean;
  createdAt: string;
  moderator: {
    id: string;
    username: string;
  };
  user?: {
    id: string;
    username: string;
  };
}

interface AutomodRule {
  id: number;
  name: string;
  type: string;
  enabled: boolean;
  trigger: any;
  action: any;
  exemptRoles: string[];
  exemptChannels: string[];
  createdAt: string;
}

interface ModerationData {
  warnings: Warning[];
  quarantineEntries: QuarantineEntry[];
  automodRules: AutomodRule[];
}

export default function ModerationPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const [data, setData] = useState<ModerationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('warnings');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (guildId && typeof guildId === 'string') {
      fetchModerationData(guildId);
    }
  }, [guildId]);

  const fetchModerationData = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/moderation/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch moderation data');
      }
      
      const moderationData = await response.json();
      setData(moderationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWarning = async (warningId: number) => {
    try {
      setActionLoading(`warn-${warningId}`);
      const response = await fetch(`/api/dashboard/moderation/warning/${warningId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh data
        await fetchModerationData(guildId as string);
      } else {
        throw new Error('Failed to delete warning');
      }
    } catch (error) {
      console.error('Error deleting warning:', error);
      alert('Failed to delete warning');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveQuarantine = async (entryId: number) => {
    try {
      setActionLoading(`quarantine-${entryId}`);
      const response = await fetch(`/api/dashboard/moderation/quarantine/${entryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh data
        await fetchModerationData(guildId as string);
      } else {
        throw new Error('Failed to remove quarantine entry');
      }
    } catch (error) {
      console.error('Error removing quarantine:', error);
      alert('Failed to remove quarantine entry');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAutomodRule = async (ruleId: number, enabled: boolean) => {
    try {
      setActionLoading(`automod-${ruleId}`);
      const response = await fetch(`/api/dashboard/moderation/automod/${ruleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        // Refresh data
        await fetchModerationData(guildId as string);
      } else {
        throw new Error('Failed to toggle automod rule');
      }
    } catch (error) {
      console.error('Error toggling automod rule:', error);
      alert('Failed to toggle automod rule');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-gray-600">Loading moderation data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600">{error || 'Moderation data not found'}</p>
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
    { id: 'warnings', name: 'Warnings', count: data.warnings.length, icon: ExclamationTriangleIcon },
    { id: 'quarantine', name: 'Quarantine', count: data.quarantineEntries.length, icon: ShieldCheckIcon },
    { id: 'automod', name: 'Automod Rules', count: data.automodRules.length, icon: EyeIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Moderation Management | Hinko Bot Dashboard</title>
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
              <ShieldCheckIcon className="h-6 w-6 text-gray-400 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Moderation Management
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Warnings</p>
                <p className="text-2xl font-semibold text-gray-900">{data.warnings.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Quarantine Entries</p>
                <p className="text-2xl font-semibold text-gray-900">{data.quarantineEntries.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <EyeIcon className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Automod Rules</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {data.automodRules.filter(r => r.enabled).length}/{data.automodRules.length}
                </p>
              </div>
            </div>
          </div>
        </div>

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
                  <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Warnings Tab */}
          {activeTab === 'warnings' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Active Warnings</h3>
                <p className="text-sm text-gray-600">Manage user warnings and violations</p>
              </div>
              <div className="overflow-hidden">
                {data.warnings.length === 0 ? (
                  <div className="text-center py-12">
                    <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No warnings</h3>
                    <p className="mt-1 text-sm text-gray-500">No active warnings found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reason
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Moderator
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.warnings.map((warning) => (
                          <tr key={warning.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {warning.user.username}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    ID: {warning.userId}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 max-w-xs truncate">
                                {warning.reason}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {warning.moderator.username}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <ClockIcon className="h-4 w-4 text-gray-400 mr-1" />
                                {new Date(warning.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleDeleteWarning(warning.id)}
                                disabled={actionLoading === `warn-${warning.id}`}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quarantine Tab */}
          {activeTab === 'quarantine' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quarantine Entries</h3>
                <p className="text-sm text-gray-600">Manage quarantined users, channels, and roles</p>
              </div>
              <div className="overflow-hidden">
                {data.quarantineEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No quarantine entries</h3>
                    <p className="mt-1 text-sm text-gray-500">No active quarantine entries found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Target
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reason
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Moderator
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.quarantineEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {entry.user?.username || entry.targetId}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    ID: {entry.targetId}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                entry.targetType === 'USER' ? 'bg-blue-100 text-blue-800' :
                                entry.targetType === 'CHANNEL' ? 'bg-green-100 text-green-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {entry.targetType}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 max-w-xs truncate">
                                {entry.reason}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {entry.moderator.username}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <ClockIcon className="h-4 w-4 text-gray-400 mr-1" />
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleRemoveQuarantine(entry.id)}
                                disabled={actionLoading === `quarantine-${entry.id}`}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Automod Rules Tab */}
          {activeTab === 'automod' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Automod Rules</h3>
                <p className="text-sm text-gray-600">Manage automatic moderation rules</p>
              </div>
              <div className="overflow-hidden">
                {data.automodRules.length === 0 ? (
                  <div className="text-center py-12">
                    <EyeIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No automod rules</h3>
                    <p className="mt-1 text-sm text-gray-500">No automod rules configured.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rule Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.automodRules.map((rule) => (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {rule.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                {rule.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                rule.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {rule.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-900">
                                <ClockIcon className="h-4 w-4 text-gray-400 mr-1" />
                                {new Date(rule.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleToggleAutomodRule(rule.id, !rule.enabled)}
                                  disabled={actionLoading === `automod-${rule.id}`}
                                  className={`${
                                    rule.enabled ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                                  } disabled:opacity-50`}
                                >
                                  {rule.enabled ? <XMarkIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
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
};