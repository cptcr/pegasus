import { RealtimeEvent, useRealtime } from "@/lib/websocket";
import { useEffect, useState } from "react";

// Event notifications component
export function RealtimeNotifications({ guildId }: { guildId: string }) {
    const { events } = useRealtime(guildId, ['*']);
    const [notifications, setNotifications] = useState<RealtimeEvent[]>([]);
  
    useEffect(() => {
      if (events.length > 0) {
        const newEvent = events[0];
        setNotifications((prev: string | any[]) => [newEvent, ...prev.slice(0, 4)]); // Keep last 5 notifications
        
        // Auto-remove notification after 5 seconds
        setTimeout(() => {
          setNotifications((prev: any[]) => prev.filter(n => n !== newEvent));
        }, 5000);
      }
    }, [events]);
  
    if (notifications.length === 0) return null;
  
    return (
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((event: RealtimeEvent, index: any) => (
          <div
            key={`${event.timestamp}-${index}`}
            className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg animate-slide-in max-w-sm"
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-white">
                {getEventDisplayName(event.type)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
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
      'warn:created': 'Warning Issued',
      'warn:deleted': 'Warning Removed',
      'poll:created': 'Poll Created',
      'poll:ended': 'Poll Ended',
      'giveaway:created': 'Giveaway Started',
      'giveaway:ended': 'Giveaway Ended',
      'ticket:created': 'Ticket Opened',
      'ticket:closed': 'Ticket Closed',
      'level:updated': 'Level Updated',
      'member:joined': 'Member Joined',
      'member:left': 'Member Left'
    };
    
    return names[eventType] || 'Update';
  }
  
  function getEventDescription(event: RealtimeEvent): string {
    switch (event.type) {
      case 'warn:created':
        return `Warning issued to ${event.data.username || 'user'}`;
      case 'poll:created':
        return `New poll: ${event.data.title || 'Untitled'}`;
      case 'giveaway:created':
        return `New giveaway: ${event.data.prize || 'Prize'}`;
      case 'ticket:created':
        return `New ticket: ${event.data.subject || 'Support Request'}`;
      case 'member:joined':
        return `${event.data.username || 'Someone'} joined the server`;
      case 'level:updated':
        return `${event.data.username || 'User'} reached level ${event.data.level || '?'}`;
      default:
        return 'Real-time update received';
    }
  }