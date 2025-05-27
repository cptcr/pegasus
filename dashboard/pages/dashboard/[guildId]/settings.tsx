// dashboard/pages/dashboard/[guildId]/settings.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ModernProtectedLayout } from '@/components/ModernProtectedLayout';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { GuildSettings } from '@/types/index'; // Use shared types

// Define specific types for channels and roles fetched from the API
interface ApiChannel { id: string; name: string; type: number; }
interface ApiRole { id: string; name: string; managed: boolean; }

const SettingsPage = () => {
  const router = useRouter();
  const { guildId } = router.query;
  const [settings, setSettings] = useState<GuildSettings | null>(null);
  const [channels, setChannels] = useState<ApiChannel[]>([]);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof guildId !== 'string') return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [settingsRes, channelsRes, rolesRes] = await Promise.all([
          fetch(`/api/dashboard/settings/${guildId}`),
          fetch(`/api/dashboard/channels/${guildId}`),
          fetch(`/api/dashboard/roles/${guildId}`),
        ]);

        if (!settingsRes.ok || !channelsRes.ok || !rolesRes.ok) {
          throw new Error('Failed to fetch initial data');
        }
        
        const settingsData: GuildSettings = await settingsRes.json();
        const channelsData: ApiChannel[] = await channelsRes.json();
        const rolesData: ApiRole[] = await rolesRes.json();

        setSettings(settingsData);
        setChannels(channelsData);
        setRoles(rolesData);
      } catch (error) {
        toast.error('Failed to load settings data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const handleUpdate = async (updatedSetting: Partial<GuildSettings>) => {
    if (typeof guildId !== 'string') return;
    setSaving(true);
    try {
      const response = await fetch(`/api/dashboard/settings/${guildId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSetting),
      });

      if (!response.ok) throw new Error('Failed to save setting');
      
      const updatedSettings: GuildSettings = await response.json();
      setSettings(updatedSettings);
      toast.success('Setting saved successfully!');

    } catch (error) {
      toast.error('Failed to save setting.');
    } finally {
      setSaving(false);
    }
  };

  // ... (other handler functions remain the same but now benefit from typed state) ...
  
  if (loading) {
    return <ModernProtectedLayout><div>Loading...</div></ModernProtectedLayout>;
  }

  return (
    <ModernProtectedLayout>
      {/* JSX remains the same, but now `settings` is strongly typed */}
    </ModernProtectedLayout>
  );
};

export default SettingsPage;