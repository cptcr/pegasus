// dashboard/pages/dashboard/[guildId]/moderation.tsx - Fixed Import Issues
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ModernProtectedLayout from '@/components/ModernProtectedLayout';
import { toast } from 'sonner';
import { Warn, Quarantine } from '@/types/index'; // Fixed import
import { formatDistanceToNow } from 'date-fns';

// Simple UI Components (instead of shadcn/ui)
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700 ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
    {children}
  </div>
);

const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
    {children}
  </h3>
);

const CardContent = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6">
    {children}
  </div>
);

const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      {children}
    </table>
  </div>
);

const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-gray-50 dark:bg-gray-700/50">
    {children}
  </thead>
);

const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
    {children}
  </tbody>
);

const TableRow = ({ children }: { children: React.ReactNode }) => (
  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/25">
    {children}
  </tr>
);

const TableHead = ({ children }: { children: React.ReactNode }) => (
  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400">
    {children}
  </th>
);

const TableCell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${className}`}>
    {children}
  </td>
);

const Badge = ({ 
  children, 
  variant = 'default' 
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
}) => {
  const variantClasses = {
    default: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
    outline: 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    destructive: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  );
};

// UI Components for this page
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="w-6 h-6 border-4 border-indigo-500 border-dashed rounded-full animate-spin"></div>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
    <p>{message}</p>
  </div>
);

const ModerationPage = () => {
  const router = useRouter();
  const { guildId } = router.query;
  const [warnings, setWarnings] = useState<Warn[]>([]);
  const [quarantined, setQuarantined] = useState<Quarantine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof guildId !== 'string') return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/moderation/${guildId}`);
        if (!res.ok) throw new Error('Failed to fetch moderation data');
        const data = await res.json();
        setWarnings(data.warnings);
        setQuarantined(data.quarantinedUsers);
      } catch (error) {
        toast.error('Could not load moderation data.');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [guildId]);

  return (
    <ModernProtectedLayout>
      <div className="p-4 space-y-8 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Moderation Overview
        </h1>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <LoadingSpinner /> : warnings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Moderator ID</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warnings.map((warning) => (
                      <TableRow key={warning.id}>
                        <TableCell>
                          <Badge variant="outline">{warning.userId}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{warning.moderatorId}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {warning.reason}
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(warning.createdAt), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <EmptyState message="No warnings have been issued recently." />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Quarantines</CardTitle>
            </CardHeader>
            <CardContent>
               {loading ? <LoadingSpinner /> : quarantined.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Quarantined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarantined.map((item) => (
                       <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="destructive">{item.userId}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.reason}
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(item.quarantinedAt), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <EmptyState message="No users are currently in quarantine." />}
            </CardContent>
          </Card>
        </div>
      </div>
    </ModernProtectedLayout>
  );
};

export default ModerationPage;