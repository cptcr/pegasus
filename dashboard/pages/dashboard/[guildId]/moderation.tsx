// dashboard/pages/dashboard/[guildId]/moderation.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ModernProtectedLayout } from '@/components/ModernProtectedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Warning, Quarantine } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';

// UI Components for this page
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="w-6 h-6 border-4 border-dashed rounded-full animate-spin border-primary"></div>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="py-8 text-center text-muted-foreground">
    <p>{message}</p>
  </div>
);


const ModerationPage = () => {
  const router = useRouter();
  const { guildId } = router.query;
  const [warnings, setWarnings] = useState<Warning[]>([]);
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
        <h1 className="text-3xl font-bold tracking-tight">Moderation Overview</h1>

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
                        <TableCell><Badge variant="outline">{warning.userId}</Badge></TableCell>
                        <TableCell><Badge variant="secondary">{warning.moderatorId}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">{warning.reason}</TableCell>
                        <TableCell>{formatDistanceToNow(new Date(warning.createdAt), { addSuffix: true })}</TableCell>
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
                        <TableCell><Badge variant="destructive">{item.userId}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">{item.reason}</TableCell>
                        <TableCell>{formatDistanceToNow(new Date(item.quarantinedAt), { addSuffix: true })}</TableCell>
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