// src/index.ts
import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { createServer, Server as HTTPServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { Command, BotEvent } from './types/index.js';
import { CommandHandler } from './handlers/CommandHandler.js';
import { EventHandler } from './handlers/EventHandler.js';
import { ButtonHandler } from './handlers/ButtonHandler.js';
import { GiveawayManager } from './modules/giveaways/GiveawayManager.js';
import { PollManager } from './modules/polls/PollManager.js';
import { TicketManager } from './modules/tickets/TicketManager.js';
import { Join2CreateManager } from './modules/voice/Join2CreateManager.js';
import { QuarantineManager } from './modules/quarantine/QuarantineManager.js';
import { WebSocketManager } from './api/WebSocketManager.js';
import { Logger } from './utils/Logger.js';
import { Config } from './config/Config.js';
import 'dotenv/config';

export class ExtendedClient extends Client {
  public readonly commands: Collection<string, Command> = new Collection();
  public readonly events: Collection<string, BotEvent<keyof import('discord.js').ClientEvents>> = new Collection();
  public readonly cooldowns: Collection<string, Collection<string, number>> = new Collection();
  
  public readonly db: PrismaClient;
  public readonly logger: typeof Logger;
  
  public readonly commandHandler: CommandHandler;
  public readonly eventHandler: EventHandler;
  public readonly buttonHandler: ButtonHandler;
  
  public readonly giveawayManager: GiveawayManager;
  public readonly pollManager: PollManager;
  public readonly ticketManager: TicketManager;
  public readonly j2cManager: Join2CreateManager;
  public readonly quarantineManager: QuarantineManager;
  
  public readonly httpServer: HTTPServer;
  public readonly wsManager: WebSocketManager;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    });

    this.logger = Logger;
    this.db = new PrismaClient();
    
    this.commandHandler = new CommandHandler(this);
    this.eventHandler = new EventHandler(this);
    this.buttonHandler = new ButtonHandler(this);

    // Initialize modules with proper dependencies
    this.giveawayManager = new GiveawayManager(this, this.db, this.logger);
    this.pollManager = new PollManager(this, this.db, this.logger);
    this.ticketManager = new TicketManager(this, this.db, this.logger);
    this.j2cManager = new Join2CreateManager(this, this.db, this.logger);
    this.quarantineManager = new QuarantineManager(this, this.db, this.logger);

    this.httpServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'ok', 
          message: 'Pegasus Bot is running',
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Pegasus Bot is running' }));
      }
    });
    
    this.wsManager = new WebSocketManager(this.httpServer, this);
  }

  public async start(): Promise<void> {
    this.logger.info('Starting Pegasus Bot...');
    
    try {
      // Connect to database
      await this.db.$connect();
      this.logger.info('Database connected successfully.');
      
      // Load commands and events
      await this.commandHandler.loadCommands();
      await this.eventHandler.loadEvents();

      // Start HTTP server for WebSocket
      this.httpServer.listen(Config.API.WEBSOCKET_PORT, () => {
        this.logger.info(`Bot WebSocket Server listening on port ${Config.API.WEBSOCKET_PORT}`);
      });

      // Login to Discord
      await this.login(process.env.DISCORD_BOT_TOKEN || Config.BOT_TOKEN);
      
    } catch (error) {
      this.logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  public async init(): Promise<void> {
    // Initialize all managers after bot is ready
    const targetGuild = this.guilds.cache.get(Config.TARGET_GUILD_ID);
    if (targetGuild) {
      await this.giveawayManager.initializeGuild(targetGuild);
      await this.pollManager.initializeGuild(targetGuild);
      await this.quarantineManager.initializeGuild(targetGuild);
      this.logger.info(`Initialized all managers for guild: ${targetGuild.name}`);
    }
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Pegasus Bot...');
    
    try {
      // Cleanup managers
      await this.giveawayManager.cleanup();
      await this.pollManager.cleanup();
      await this.ticketManager.cleanup();
      await this.quarantineManager.cleanup();
      
      // Close WebSocket server
      this.wsManager.close();
      
      // Close HTTP server
      this.httpServer.close();
      
      // Disconnect from database
      await this.db.$disconnect();
      
      // Destroy client
      this.destroy();
      
      this.logger.info('Bot shutdown complete.');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }
}

const client = new ExtendedClient();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  await client.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM. Graceful shutdown...');
  await client.shutdown();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process for unhandled rejections in production
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Exit on uncaught exceptions
  process.exit(1);
});

// Start the bot
client.start();