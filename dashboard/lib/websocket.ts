
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

