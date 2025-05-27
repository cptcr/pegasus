// dashboard/components/EventNotifications.tsx
import { RealtimeEvent, WarnCreateData, PollCreateData, GiveawayCreateData, TicketCreateData, MemberJoinLeaveData, LevelUpdateData, GuildStatsUpdateData } from '@/types/index'; // Adjusted import
import { useRealtime } from "@/lib/websocket";
import { useEffect, useState } from "react";

// Event notifications component
export function RealtimeNotifications({ guildId }: { guildId: string }) {
    const { events } = useRealtime(guildId, ['*']); // Listen to all events for notifications
    const [notifications, setNotifications] = useState<RealtimeEvent<unknown>[]>([]);

    useEffect(() => {
      if (events.length > 0) {
        const newEvent = events[0]; // Get the most recent event
        setNotifications((prevNotifications) => [newEvent, ...prevNotifications.slice(0, 4)]); // Keep last 5 notifications

        // Auto-remove notification after 5 seconds
        const timer = setTimeout(() => {
          setNotifications((prevNotifications) => prevNotifications.filter(n => n !== newEvent));
        }, 5000);
        return () => clearTimeout(timer); // Cleanup timer on unmount or if events change
      }
    }, [events]); // Rerun effect when 'events' array changes

    if (notifications.length === 0) return null;

    return (
      <div className="fixed z-50 space-y-2 top-4 right-4">
        {notifications.map((event, index) => ( // Index can be used as key if events don't have unique IDs suitable for keys
          <div
            key={`${event.timestamp}-${index}`} // Using timestamp and index for a more unique key
            className="max-w-sm p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-lg animate-slide-in"
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-white">
                {getEventDisplayName(event.type)}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {getEventDescription(event)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  function getEventDisplayName(eventType: string): string {
    const names: Record<string, string> = {
      'guild:updated': 'Guild Updated',
      'guild:stats:updated': 'Guild Stats Updated',
      'activity:updated': 'Activity Updated',
      'warn:created': 'Warning Issued',
      'warn:deleted': 'Warning Removed',
      'poll:created': 'Poll Created',
      'poll:voted': 'Poll Voted',
      'poll:ended': 'Poll Ended',
      'giveaway:created': 'Giveaway Started',
      'giveaway:entered': 'Giveaway Entered',
      'giveaway:ended': 'Giveaway Ended',
      'ticket:created': 'Ticket Opened',
      'ticket:closed': 'Ticket Closed',
      'ticket:updated': 'Ticket Updated',
      'level:updated': 'Level Updated',
      'command:used': 'Command Used',
      'member:joined': 'Member Joined',
      'member:left': 'Member Left',
      'quarantine:added': 'User Quarantined',
      'quarantine:removed': 'User Unquarantined',
      'j2c:channel:created': 'Voice Channel Created',
      'j2c:channel:deleted': 'Voice Channel Deleted',
    };
    return names[eventType] || 'System Update'; // Default for unknown event types
  }

  function getEventDescription(event: RealtimeEvent<unknown>): string {
    // Type guards or casting for event.data based on event.type
    switch (event.type) {
      case 'warn:created':
        const warnData = event.data as WarnCreateData;
        return `Warning issued to ${warnData.username || `user ID ${warnData.userId}`}`;
      case 'poll:created':
        const pollData = event.data as PollCreateData;
        return `New poll: ${pollData.title || 'Untitled'}`;
      case 'giveaway:created':
        const giveawayData = event.data as GiveawayCreateData;
        return `New giveaway: ${giveawayData.prize || 'Prize'}`;
      case 'ticket:created':
        const ticketData = event.data as TicketCreateData;
        return `New ticket: #${ticketData.id} - ${ticketData.subject || 'Support Request'}`;
      case 'member:joined':
        const memberJoinedData = event.data as MemberJoinLeaveData;
        return `${memberJoinedData.username || `User ID ${memberJoinedData.userId}`} joined the server`;
       case 'member:left':
        const memberLeftData = event.data as MemberJoinLeaveData;
        return `${memberLeftData.username || `User ID ${memberLeftData.userId}`} left the server`;
      case 'level:updated':
        const levelData = event.data as LevelUpdateData;
        return `${levelData.username || `User ID ${levelData.userId}`} reached level ${levelData.level || '?'}`;
      case 'guild:stats:updated':
        const guildStats = event.data as GuildStatsUpdateData;
        return `Member count: ${guildStats.memberCount}, Online: ${guildStats.onlineCount}`;
      default:
        // Try to serialize generic data, or provide a default message
        try {
          const dataString = JSON.stringify(event.data);
          if (dataString.length > 100) {
            return `Real-time update received (data too long to display).`;
          }
          return `Update: ${dataString}`;
        } catch {
          return 'Real-time update received.';
        }
    }
  }