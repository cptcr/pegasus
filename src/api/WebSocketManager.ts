// src/api/WebSocketManager.ts - Fixed WebSocket Manager
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ExtendedClient } from '../index.js';
import { Logger } from '@/utils/Logger.js';

export class WebSocketManager {
  private io: SocketIOServer;
  private client: ExtendedClient;
  private logger: Logger;

  constructor(httpServer: HTTPServer, client: ExtendedClient, logger: Logger) {
    this.client = client;
    this.logger = logger;
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.DASHBOARD_URL || "http://localhost:3001",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      this.logger.info(`Dashboard client connected: ${socket.id}`);

      socket.on('join:guild', (guildId: string) => {
        socket.join(`guild:${guildId}`);
        this.logger.debug(`Client ${socket.id} joined guild room: ${guildId}`);
      });

      socket.on('leave:guild', (guildId: string) => {
        socket.leave(`guild:${guildId}`);
        this.logger.debug(`Client ${socket.id} left guild room: ${guildId}`);
      });

      socket.on('disconnect', () => {
        this.logger.debug(`Dashboard client disconnected: ${socket.id}`);
      });

      // Send initial connection data
      socket.emit('connected', {
        timestamp: new Date().toISOString(),
        clientCount: this.getConnectedClientsCount()
      });
    });
  }

  /**
   * Emit real-time update to dashboard clients
   */
  emitUpdate(guildId: string, eventType: string, data: any): void {
    this.io.to(`guild:${guildId}`).emit('realtime:update', {
      type: eventType,
      guildId,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit quarantine event
   */
  emitQuarantineUpdate(guildId: string, action: 'added' | 'removed', data: any): void {
    this.emitUpdate(guildId, `quarantine:${action}`, data);
  }

  /**
   * Emit poll event
   */
  emitPollUpdate(guildId: string, action: 'created' | 'ended' | 'voted', data: any): void {
    this.emitUpdate(guildId, `poll:${action}`, data);
  }

  /**
   * Emit giveaway event
   */
  emitGiveawayUpdate(guildId: string, action: 'created' | 'ended' | 'entered', data: any): void {
    this.emitUpdate(guildId, `giveaway:${action}`, data);
  }

  /**
   * Emit ticket event
   */
  emitTicketUpdate(guildId: string, action: 'created' | 'closed' | 'updated', data: any): void {
    this.emitUpdate(guildId, `ticket:${action}`, data);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(event: string, data: any): void {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send message to specific guild rooms
   */
  sendToGuild(guildId: string, event: string, data: any): void {
    this.io.to(`guild:${guildId}`).emit(event, {
      ...data,
      guildId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Get guild room information
   */
  getGuildRoomInfo(guildId: string): { clientCount: number } {
    const room = this.io.sockets.adapter.rooms.get(`guild:${guildId}`);
    return {
      clientCount: room ? room.size : 0
    };
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    this.io.close();
    this.logger.info('WebSocket server closed');
  }
}