// src/api/WebSocketManager.ts - Fixed WebSocket Manager
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ExtendedClient } from '../index.js';
import { Logger } from '../utils/Logger.js';
import { RealtimeEvent } from '../types/index.js';

export class WebSocketManager {
  private io: SocketIOServer;
  private client: ExtendedClient;
  private logger: Logger;

  constructor(httpServer: HTTPServer, client: ExtendedClient) {
    this.client = client;
    this.logger = client.logger;

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.DASHBOARD_URL || "http://localhost:3001",
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
          // Send confirmation
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

      // Send initial connection data
      socket.emit('connected', {
        timestamp: new Date().toISOString(),
        message: 'Successfully connected to Bot WebSocket.',
        serverTime: Date.now()
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
    this.io.to(`guild:${guildId}`).emit('realtime:event', eventPayload);
    this.logger.debug(`Emitted [${eventType}] to guild ${guildId} room.`);
  }

  // Specific event emitters for different systems
  public emitGuildStatsUpdate(guildId: string, stats: { memberCount?: number; onlineCount?: number }): void {
    this.emitRealtimeEvent(guildId, 'guild:stats:updated', stats);
  }

  public emitWarnCreate(guildId: string, data: { userId: string; username?: string; moderatorId: string; reason: string }): void {
    this.emitRealtimeEvent(guildId, 'warn:created', data);
  }

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

  public emitLevelUpdate(guildId: string, data: { userId: string; username?: string; level: number; xp: number }): void {
    this.emitRealtimeEvent(guildId, 'level:updated', data);
  }

  public emitMemberJoin(guildId: string, data: { userId: string; username?: string }): void {
    this.emitRealtimeEvent(guildId, 'member:joined', data);
  }

  public emitMemberLeave(guildId: string, data: { userId: string; username?: string }): void {
    this.emitRealtimeEvent(guildId, 'member:left', data);
  }

  /**
   * Broadcast a generic message to all connected dashboard clients.
   * Use sparingly; prefer guild-specific events.
   */
  public broadcastGeneralEvent<T>(eventType: string, data: T): void {
    const eventPayload = {
      type: eventType,
      scope: 'global',
      data,
      timestamp: new Date().toISOString()
    };
    this.io.emit('realtime:event', eventPayload);
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