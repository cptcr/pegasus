
// dashboard/lib/websocket.ts (Real-time Updates)
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RealtimeEvent {
  type: 'guild:updated' | 'warn:created' | 'warn:deleted' | 'poll:created' | 'poll:ended' | 
        'giveaway:created' | 'giveaway:ended' | 'ticket:created' | 'ticket:closed' | 
        'level:updated' | 'command:used' | 'member:joined' | 'member:left';
  guildId: string;
  data: any;
  timestamp: string;
}

class RealtimeService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(event: RealtimeEvent) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  connect(guildId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        this.socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || '', {
          query: { guildId },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        this.socket.on('connect', () => {
          console.log('✅ Real-time connection established');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('🔌 Real-time connection lost:', reason);
          this.isConnecting = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Real-time connection error:', error);
          this.isConnecting = false;
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error('Failed to establish real-time connection'));
          }
        });

        this.socket.on('realtime:event', (event: RealtimeEvent) => {
          this.handleEvent(event);
        });

        // Guild-specific events
        this.socket.on('guild:stats:updated', (data) => {
          this.handleEvent({
            type: 'guild:updated',
            guildId: data.guildId,
            data: data.stats,
            timestamp: new Date().toISOString()
          });
        });

        this.socket.on('activity:updated', (data) => {
          this.handleEvent({
            type: 'guild:updated',
            guildId: data.guildId,
            data: { activity: data.activity },
            timestamp: new Date().toISOString()
          });
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.isConnecting = false;
    console.log('🔌 Real-time connection closed');
  }

  subscribe(eventType: string, callback: (event: RealtimeEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  private handleEvent(event: RealtimeEvent): void {
    // Notify all listeners for this event type
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in realtime event callback:', error);
        }
      });
    }

    // Notify all listeners for 'all' events
    const allCallbacks = this.listeners.get('*');
    if (allCallbacks) {
      allCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in realtime event callback:', error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }
}

// Singleton instance
export const realtimeService = new RealtimeService();

// React Hook for real-time updates
export function useRealtime(guildId: string, eventTypes: string[] = ['*']) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const unsubscribeFunctions = useRef<(() => void)[]>([]);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        await realtimeService.connect(guildId);
        if (mounted) {
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Failed to connect to real-time service:', error);
        if (mounted) {
          setIsConnected(false);
        }
      }
    };

    connect();

    // Subscribe to events
    eventTypes.forEach(eventType => {
      const unsubscribe = realtimeService.subscribe(eventType, (event) => {
        if (mounted) {
          setLastEvent(event);
          setEvents(prev => [event, ...prev.slice(0, 99)]); // Keep last 100 events
        }
      });
      unsubscribeFunctions.current.push(unsubscribe);
    });

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      if (mounted) {
        setIsConnected(realtimeService.isConnected());
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(statusInterval);
      
      // Unsubscribe from all events
      unsubscribeFunctions.current.forEach(unsubscribe => unsubscribe());
      unsubscribeFunctions.current = [];
    };
  }, [guildId, eventTypes.join(',')]);

  return {
    isConnected,
    lastEvent,
    events,
    subscribe: (eventType: string, callback: (event: RealtimeEvent) => void) => 
      realtimeService.subscribe(eventType, callback),
    emit: (event: string, data: any) => realtimeService.emit(event, data)
  };
}

// Hook for specific data updates
export function useRealtimeData<T>(
  guildId: string,
  initialData: T,
  eventTypes: string[] = ['guild:updated']
) {
  const [data, setData] = useState<T>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { isConnected, subscribe } = useRealtime(guildId, eventTypes);

  useEffect(() => {
    const unsubscribes = eventTypes.map(eventType => 
      subscribe(eventType, (event) => {
        if (event.guildId === guildId) {
          setData(prev => ({
            ...prev,
            ...event.data
          }));
          setLastUpdated(new Date());
        }
      })
    );

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [guildId, eventTypes.join(','), subscribe]);

  return {
    data,
    lastUpdated,
    isConnected,
    refresh: () => setLastUpdated(new Date())
  };
}

// Hook for guild stats with real-time updates
export function useGuildStats(guildId: string, initialStats: any) {
  return useRealtimeData(initialStats, ['guild:updated', 'activity:updated'], guildId);
}

// Hook for activity data with real-time updates
export function useActivityData(guildId: string, initialActivity: any) {
  return useRealtimeData(initialActivity, ['activity:updated'], guildId);
}

// Connection status indicator component
export function ConnectionStatus({ guildId }: { guildId: string }) {
  const { isConnected } = useRealtime(guildId, []);

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      isConnected 
        ? 'bg-green-900/20 text-green-400 border border-green-500/20' 
        : 'bg-red-900/20 text-red-400 border border-red-500/20'
    }`}>
      <div className={`w-2 h-2 rounded-full mr-1 ${
        isConnected ? 'bg-green-400' : 'bg-red-400'
      } ${isConnected ? 'animate-pulse' : ''}`} />
      {isConnected ? 'Live' : 'Offline'}
    </div>
  );
}

// Event notifications component
export function RealtimeNotifications({ guildId }: { guildId: string }) {
  const { events } = useRealtime(guildId, ['*']);
  const [notifications, setNotifications] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    if (events.length > 0) {
      const newEvent = events[0];
      setNotifications(prev => [newEvent, ...prev.slice(0, 4)]); // Keep last 5 notifications
      
      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n !== newEvent));
      }, 5000);
    }
  }, [events]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((event, index) => (
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