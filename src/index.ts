// src/index.ts - Fixed Main Bot Entry Point with Prisma Fix
import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { createServer, Server as HTTPServer } from 'http';
import { Command } from './types/index.js';
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
import { Config, validateConfig } from './config/Config.js';
import { prisma, disconnectPrisma } from './database/PrismaClient.js';
import 'dotenv/config';

export class ExtendedClient extends Client {
  public readonly commands: Collection<string, Command> = new Collection();
  public readonly cooldowns: Collection<string, Collection<string, number>> = new Collection();
  
  public readonly db = prisma;
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
    
    this.commandHandler = new CommandHandler(this);
    this.eventHandler = new EventHandler(this);
    this.buttonHandler = new ButtonHandler(this);

    // Initialize modules with proper dependencies
    this.giveawayManager = new GiveawayManager(this, this.db, this.logger);
    this.pollManager = new PollManager(this, this.db, this.logger);
    this.ticketManager = new TicketManager(this, this.db, this.logger);
    this.j2cManager = new Join2CreateManager(this, this.db, this.logger);
    this.quarantineManager = new QuarantineManager(this, this.db, this.logger);

    // Create HTTP server for WebSocket
    this.httpServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'ok', 
          message: 'Pegasus Bot is running',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          guilds: this.guilds.cache.size,
          users: this.users.cache.size
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'ok', 
          message: 'Pegasus Bot WebSocket Server',
          timestamp: new Date().toISOString()
        }));
      }
    });
    
    this.wsManager = new WebSocketManager(this.httpServer, this);
  }

  public async start(): Promise<void> {
    this.logger.info('🚀 Starting Pegasus Bot...');
    
    try {
      // Validate configuration
      const configValidation = validateConfig();
      if (!configValidation.valid) {
        this.logger.error('❌ Configuration validation failed:');
        configValidation.errors.forEach(error => this.logger.error(`   - ${error}`));
        process.exit(1);
      }

      // Connect to database with error handling
      try {
        await this.db.$connect();
        this.logger.info('✅ Database connected successfully.');
        
        // Test database connection
        await this.db.$queryRaw`SELECT 1`;
        this.logger.info('✅ Database connection tested successfully.');
      } catch (dbError) {
        this.logger.error('❌ Database connection failed:', dbError);
        throw dbError;
      }

      // Load commands and events
      await this.commandHandler.loadCommands();
      await this.eventHandler.loadEvents();

      // Start HTTP server for WebSocket
      this.httpServer.listen(Config.API.WEBSOCKET_PORT, () => {
        this.logger.info(`🌐 Bot WebSocket Server listening on port ${Config.API.WEBSOCKET_PORT}`);
      });

      // Login to Discord
      await this.login(Config.BOT_TOKEN);
      
    } catch (error) {
      this.logger.error('❌ Failed to start bot:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  public async init(): Promise<void> {
    this.logger.info('🔧 Initializing bot systems...');
    
    try {
      // Ensure target guild exists in database
      const targetGuild = this.guilds.cache.get(Config.TARGET_GUILD_ID);
      if (targetGuild) {
        await this.db.guild.upsert({
          where: { id: targetGuild.id },
          update: { 
            name: targetGuild.name,
            updatedAt: new Date()
          },
          create: {
            id: targetGuild.id,
            name: targetGuild.name
          }
        });

        // Initialize all managers
        await Promise.all([
          this.giveawayManager.initializeGuild(targetGuild),
          this.pollManager.initializeGuild(targetGuild),
          this.quarantineManager.initializeGuild(targetGuild),
          this.ticketManager.initializeGuild(targetGuild)
        ]);

        this.logger.info(`✅ Initialized all systems for guild: ${targetGuild.name}`);

        // Start periodic stats updates
        this.startStatsUpdates(targetGuild.id);
      } else {
        this.logger.warn(`⚠️ Target guild ${Config.TARGET_GUILD_ID} not found`);
      }
    } catch (error) {
      this.logger.error('❌ Error during initialization:', error);
    }
  }

  private startStatsUpdates(guildId: string): void {
    const updateStats = async () => {
      try {
        const guild = this.guilds.cache.get(guildId);
        if (!guild) return;

        // Fetch fresh member data
        await guild.members.fetch();
        
        const memberCount = guild.memberCount;
        const onlineCount = guild.presences.cache.filter(p => p.status !== 'offline').size;

        const stats = {
          memberCount,
          onlineCount
        };

        // Emit to dashboard
        this.wsManager.emitGuildStatsUpdate(guildId, stats);
        
        this.logger.debug(`📊 Updated guild stats: ${memberCount} members, ${onlineCount} online`);
      } catch (error) {
        this.logger.error('❌ Failed to update guild stats:', error);
      }
    };
    
    // Update immediately, then every 5 minutes
    updateStats();
    setInterval(updateStats, 5 * 60 * 1000);
  }

  public async shutdown(): Promise<void> {
    this.logger.info('🛑 Shutting down Pegasus Bot...');
    
    try {
      // Cleanup managers
      await Promise.all([
        this.giveawayManager.cleanup(),
        this.pollManager.cleanup(),
        this.ticketManager.cleanup(),
        this.quarantineManager.cleanup()
      ]);
      
      // Close WebSocket server
      this.wsManager.close();
      
      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Disconnect from database
      await disconnectPrisma();
      
      // Destroy Discord client
      this.destroy();
      
      this.logger.info('✅ Bot shutdown complete.');
    } catch (error) {
      this.logger.error('❌ Error during shutdown:', error);
    }
  }
}

// Create bot instance
const client = new ExtendedClient();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  await client.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  await client.shutdown();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Log but don't exit in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Exit on uncaught exceptions
  process.exit(1);
});

// Start the bot if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  client.start().catch(error => {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  });
}

export default client;