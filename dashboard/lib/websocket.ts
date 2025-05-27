// dashboard/lib/websocket.ts (Real-time Updates)
import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { RealtimeEvent as SharedRealtimeEvent } from '@/types/index';

// Re-exporting with additional properties if needed
export interface RealtimeEvent<T = unknown> extends SharedRealtimeEvent<T> {
  // Add any additional properties specific to the websocket implementation
}

class RealtimeService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(event: RealtimeEvent<unknown>) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;
  private currentGuildId: string | null = null;

  connect(guildId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected && this.currentGuildId === guildId) {
        resolve();
        return;
      }

      if (this.isConnecting && this.currentGuildId === guildId) {
        resolve();
        return;
      }

      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      this.currentGuildId = guildId;
      this.isConnecting = true;
      this.reconnectAttempts = 0;

      try {
        const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || '';
        if (!websocketUrl) {
          console.error('❌ NEXT_PUBLIC_WEBSOCKET_URL is not set.');
          this.isConnecting = false;
          reject(new Error('WebSocket URL is not configured.'));
          return;
        }

        this.socket = io(websocketUrl, {
          query: { guildId },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        this.socket.on('connect', () => {
          console.log(`✅ Real-time connection established for guild ${guildId}`);
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          resolve();
        });

        this.socket.on('disconnect', (reason: Socket.DisconnectReason) => {
          console.log(`🔌 Real-time connection lost for guild ${guildId}: ${reason}`);
          this.isConnecting = false;
        });

        this.socket.on('connect_error', (error: Error) => {
          console.error(`❌ Real-time connection error for guild ${guildId}:`, error.message);
          this.isConnecting = false;
          this.reconnectAttempts++;

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.socket?.disconnect();
            reject(new Error('Failed to establish real-time connection after multiple attempts.'));
          }
        });

        this.socket.on('realtime:event', (event: RealtimeEvent<unknown>) => {
          this.handleEvent(event);
        });
        
        this.socket.on('realtime:update', (event: RealtimeEvent<unknown>) => {
            this.handleEvent(event);
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
    this.isConnecting = false;
    this.currentGuildId = null;
    console.log('🔌 Real-time connection explicitly closed');
  }

  subscribe(eventType: string, callback: (event: RealtimeEvent<unknown>) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

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

  private handleEvent(event: RealtimeEvent<unknown>): void {
    if (event.guildId !== this.currentGuildId) {
      return;
    }

    const notifySpecific = this.listeners.get(event.type);
    if (notifySpecific) {
      notifySpecific.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in specific realtime event callback:', error);
        }
      });
    }

    const notifyAll = this.listeners.get('*');
    if (notifyAll) {
      notifyAll.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in wildcard realtime event callback:', error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  emit(event: string, data: { guildId: string, [key: string]: unknown }): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`[RealtimeService] Cannot emit event '${event}', socket not connected.`);
    }
  }
}

export const realtimeService = new RealtimeService();

export function useRealtime(guildId: string, eventTypes: string[] = ['*']) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent<unknown> | null>(null);
  const [events, setEvents] = useState<RealtimeEvent<unknown>[]>([]);
  const unsubscribeFunctionsRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    let mounted = true;

    const connectAndSubscribe = async () => {
      if (!guildId) return;

      try {
        await realtimeService.connect(guildId);
        if (mounted) {
          setIsConnected(realtimeService.isConnected());
        }
      } catch (error) {
        console.error('Failed to connect to real-time service:', error);
        if (mounted) {
          setIsConnected(false);
        }
      }

      unsubscribeFunctionsRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribeFunctionsRef.current = [];

      if (realtimeService.isConnected()) {
        eventTypes.forEach(eventType => {
          const unsubscribe = realtimeService.subscribe(eventType, (event) => {
            if (mounted) {
              setLastEvent(event);
              setEvents(prev => [event, ...prev.slice(0, 99)]);
            }
          });
          unsubscribeFunctionsRef.current.push(unsubscribe);
        });
      }
    };

    connectAndSubscribe();

    const statusInterval = setInterval(() => {
      if (mounted) {
        setIsConnected(realtimeService.isConnected());
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(statusInterval);
      unsubscribeFunctionsRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribeFunctionsRef.current = [];
    };
  }, [guildId, eventTypes.join(',')]);

  const emitToServer = useCallback((event: string, data: { [key: string]: unknown }) => {
      realtimeService.emit(event, { guildId, ...data});
  }, [guildId]);

  return {
    isConnected,
    lastEvent,
    events,
    subscribe: realtimeService.subscribe.bind(realtimeService),
    emit: emitToServer,
  };
}

export function useRealtimeData<T extends object>(
  guildId: string,
  initialData: T,
  eventTypesToUpdateOn: string[] = ['guild:updated']
) {
  const [data, setData] = useState<T>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { isConnected, subscribe } = useRealtime(guildId, eventTypesToUpdateOn);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!isConnected || !guildId) return;

    const unsubscribes = eventTypesToUpdateOn.map(eventType =>
      subscribe(eventType, (event: RealtimeEvent<unknown>) => {
        if (event.guildId === guildId && event.data) {
          setData(prev => ({
            ...prev,
            ...(event.data as object)
          }));
          setLastUpdated(new Date());
        }
      })
    );

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [guildId, eventTypesToUpdateOn.join(','), subscribe, isConnected]);

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  return {
    data,
    lastUpdated,
    isConnected,
    refresh
  };
}

interface GuildStatsData { 
  [key: string]: unknown;
}

export function useGuildStats(guildId: string, initialStats: GuildStatsData) {
  return useRealtimeData<GuildStatsData>(guildId, initialStats, ['guild:updated', 'guild:stats:updated', 'activity:updated']);
}

interface ActivityData { 
  [key: string]: unknown;
}

export function useActivityData(guildId: string, initialActivity: ActivityData) {
  return useRealtimeData<ActivityData>(guildId, initialActivity, ['activity:updated']);
}