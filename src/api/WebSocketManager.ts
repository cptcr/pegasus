// src/api/WebSocketManager.ts - Real-time Dashboard Updates
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ExtendedClient } from '../index.js';
import { Logger } from '../utils/Logger.js';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { GiveawayManager } from '@/modules/giveaways/GiveawayManager.js';
import { Config } from '@/config/Config.js';

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

      socket.on('disconnect', () => {
        this.logger.debug(`Dashboard client disconnected: ${socket.id}`);
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
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    this.io.close();
    this.logger.info('WebSocket server closed');
  }
}

// Helper function implementations for command handlers
async function handleGiveawayCreate(interaction: ChatInputCommandInteraction, giveawayManager: GiveawayManager) {
  await interaction.deferReply();

  const title = interaction.options.getString('title', true);
  const prize = interaction.options.getString('prize', true);
  const durationStr = interaction.options.getString('duration', true);
  const winners = interaction.options.getInteger('winners') || 1;
  const description = interaction.options.getString('description');
  const requiredRole = interaction.options.getRole('required_role');
  const requiredLevel = interaction.options.getInteger('required_level');
  const targetChannel = interaction.options.getChannel('channel');

  // Parse duration
  const duration = parseDuration(durationStr);
  if (!duration) {
    return interaction.editReply('Invalid duration format. Use formats like: 1d, 12h, 30m');
  }

  const channelId = targetChannel?.id || interaction.channelId;

  const requirements: any = {};
  if (requiredRole) requirements.roleRequired = requiredRole.id;
  if (requiredLevel) requirements.levelRequired = requiredLevel;

  const result = await giveawayManager.createGiveaway(interaction.guild!, {
    title,
    description: description || undefined,
    prize,
    duration,
    winners,
    creatorId: interaction.user.id,
    channelId,
    requirements: Object.keys(requirements).length > 0 ? requirements : undefined
  });

  if (!result.success) {
    return interaction.editReply(`Failed to create giveaway: ${result.error}`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Giveaway Created`)
    .setDescription(`Successfully created giveaway: **${title}**`)
    .addFields(
      { name: 'Giveaway ID', value: result.giveaway!.id.toString(), inline: true },
      { name: 'Prize', value: prize, inline: true },
      { name: 'Winners', value: winners.toString(), inline: true },
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'Duration', value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, inline: true }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// Helper function to parse duration strings (same as in other files)
function parseDuration(duration: string): number | null {
  const regex = /^(\d+)([dhm])$/i;
  const match = duration.match(regex);
  
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000; // days to ms
    case 'h': return value * 60 * 60 * 1000; // hours to ms
    case 'm': return value * 60 * 1000; // minutes to ms
    default: return null;
  }
}