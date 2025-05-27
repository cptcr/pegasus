// src/api/WebSocketManager.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ExtendedClient } from '../index'; // Use default import
import { Logger as BotLogger } from '@/utils/Logger'; // Use default import
import { RealtimeEvent } from '@/types/index'; // Use shared RealtimeEvent

export class WebSocketManager {
  private io: SocketIOServer;
  private client: ExtendedClient;
  private logger: typeof BotLogger;

  constructor(httpServer: HTTPServer, client: ExtendedClient) { // Removed logger from constructor, use client.logger
    this.client = client;
    this.logger = client.logger; // Use the logger from the client instance

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.DASHBOARD_URL || "http://localhost:3001", // Ensure this matches your dashboard URL
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupEventHandlers();
    this.logger.info('WebSocketManager initialized and event handlers set up.');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.logger.info(`Dashboard client connected: ${socket.id}`);

      socket.on('join:guild', (guildId: string) => {
        if (typeof guildId === 'string' && guildId.length > 0) {
          socket.join(`guild:${guildId}`);
          this.logger.debug(`Client ${socket.id} joined guild room: ${guildId}`);
           // Optionally send confirmation or initial data for that guild
           socket.emit('room:joined', { guildId, message: `Successfully joined room for guild ${guildId}` });
        } else {
            this.logger.warn(`Client ${socket.id} tried to join invalid guild room: ${guildId}`);
        }
      });

      socket.on('leave:guild', (guildId: string) => {
         if (typeof guildId === 'string' && guildId.length > 0) {
            socket.leave(`guild:${guildId}`);
            this.logger.debug(`Client ${socket.id} left guild room: ${guildId}`);
             socket.emit('room:left', { guildId, message: `Successfully left room for guild ${guildId}` });
        } else {
            this.logger.warn(`Client ${socket.id} tried to leave invalid guild room: ${guildId}`);
        }
      });

      socket.on('disconnect', (reason: string) => {
        this.logger.debug(`Dashboard client disconnected: ${socket.id}, Reason: ${reason}`);
      });

      // Send initial connection data (more generic)
      socket.emit('connected', {
        timestamp: new Date().toISOString(),
        message: 'Successfully connected to Bot WebSocket.',
        serverTime: Date.now() // Example of sending server time
      });
    });
  }

  /**
   * Emit real-time update to dashboard clients.
   * This is the primary method for sending structured events.
   */
  public emitRealtimeEvent<T>(guildId: string, eventType: string, data: T): void {
    const eventPayload: RealtimeEvent<T> = {
      type: eventType,
      guildId,
      data,
      timestamp: new Date().toISOString()
    };
    this.io.to(`guild:${guildId}`).emit('realtime:event', eventPayload); // Standardized event name
    this.logger.debug(`Emitted [${eventType}] to guild ${guildId} room.`);
  }


  // Specific event emitters now use emitRealtimeEvent for consistency
  public emitQuarantineUpdate(guildId: string, action: 'added' | 'removed', data: unknown): void {
    this.emitRealtimeEvent(guildId, `quarantine:${action}`, data);
  }

  public emitPollUpdate(guildId: string, action: 'created' | 'ended' | 'voted', data: unknown): void {
    this.emitRealtimeEvent(guildId, `poll:${action}`, data);
  }

  public emitGiveawayUpdate(guildId: string, action: 'created' | 'ended' | 'entered', data: unknown): void {
    this.emitRealtimeEvent(guildId, `giveaway:${action}`, data);
  }

  public emitTicketUpdate(guildId: string, action: 'created' | 'closed' | 'updated', data: unknown): void {
    this.emitRealtimeEvent(guildId, `ticket:${action}`, data);
  }

  /**
   * Broadcast a generic message to all connected dashboard clients.
   * Use sparingly; prefer guild-specific events.
   */
  public broadcastGeneralEvent<T>(eventType: string, data: T): void {
    const eventPayload: Omit<RealtimeEvent<T>, 'guildId'> & { scope: 'global' } = { // guildId might not be relevant for global
      type: eventType,
      scope: 'global',
      data,
      timestamp: new Date().toISOString()
    };
    this.io.emit('realtime:event', eventPayload); // Use the same event name for consistency
    this.logger.debug(`Broadcasted global event [${eventType}].`);
  }


  public getConnectedClientsCount(): number {
    return this.io.sockets.sockets.size;
  }

  public getGuildRoomInfo(guildId: string): { clientCount: number } {
    const room = this.io.sockets.adapter.rooms.get(`guild:${guildId}`);
    return {
      clientCount: room ? room.size : 0
    };
  }

  public close(): void {
    this.io.close((err?: Error) => {
        if (err) {
            this.logger.error('Error closing WebSocket server:', err);
        } else {
            this.logger.info('WebSocket server closed successfully.');
        }
    });
  }
}