// src/index.ts - Fixed Main Bot Entry Point with Proper Startup Flow
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
// Load environment variables FIRST before anything else
import { config } from 'dotenv';
config();

console.log('🔧 Dotenv loaded, checking key variables:');
console.log(`   DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID ? '✓' : '❌'}`);
console.log(`   DISCORD_BOT_TOKEN: ${process.env.DISCORD_BOT_TOKEN ? '✓' : '❌'}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓' : '❌'}`);
console.log(`   TARGET_GUILD_ID: ${process.env.TARGET_GUILD_ID || 'NOT SET'}`);
console.log('');

// Now import everything else

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

  private systemIntervals: Map<string, NodeJS.Timeout> = new Map();

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
    
    // Initialize handlers
    this.commandHandler = new CommandHandler(this);
    this.eventHandler = new EventHandler(this);
    this.buttonHandler = new ButtonHandler(this);

    // Initialize modules
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
    console.log('🚀 Starting Pegasus Bot...');
    this.logger.info('🚀 Starting Pegasus Bot...');
    
    try {
      // Step 1: Validate configuration
      console.log('⚙️ Validating configuration...');
      const configValidation = validateConfig();
      if (!configValidation.valid) {
        console.error('❌ Configuration validation failed:');
        this.logger.error('❌ Configuration validation failed:');
        configValidation.errors.forEach(error => {
          console.error(`   - ${error}`);
          this.logger.error(`   - ${error}`);
        });
        process.exit(1);
      }
      console.log('✅ Configuration validated');

      // Step 2: Connect to database
      console.log('🔌 Connecting to database...');
      try {
        await this.db.$connect();
        console.log('✅ Database connected successfully');
        this.logger.info('✅ Database connected successfully.');
        
        // Test database connection
        await this.db.$queryRaw`SELECT 1`;
        console.log('✅ Database connection tested');
        this.logger.info('✅ Database connection tested successfully.');
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError);
        this.logger.error('❌ Database connection failed:', dbError);
        throw dbError;
      }

      // Step 3: Load commands and events
      console.log('📋 Loading commands...');
      await this.commandHandler.loadCommands();
      console.log(`✅ Loaded ${this.commands.size} commands`);

      console.log('📅 Loading events...');
      await this.eventHandler.loadEvents();
      console.log('✅ Events loaded');

      // Step 4: Start HTTP server for WebSocket
      console.log('🌐 Starting WebSocket server...');
      this.httpServer.listen(Config.API.WEBSOCKET_PORT, () => {
        console.log(`✅ Bot WebSocket Server listening on port ${Config.API.WEBSOCKET_PORT}`);
        this.logger.info(`🌐 Bot WebSocket Server listening on port ${Config.API.WEBSOCKET_PORT}`);
      });

      // Step 5: Login to Discord
      console.log('🔐 Logging in to Discord...');
      await this.login(Config.BOT_TOKEN);
      console.log('✅ Logged in to Discord successfully');
      
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      this.logger.error('❌ Failed to start bot:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  public async init(): Promise<void> {
    console.log('🔧 Initializing bot systems...');
    this.logger.info('🔧 Initializing bot systems...');
    
    try {
      // Get target guild
      const targetGuild = this.guilds.cache.get(Config.TARGET_GUILD_ID);
      if (targetGuild) {
        console.log(`📍 Found target guild: ${targetGuild.name}`);
        
        // Ensure guild exists in database
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

        // Initialize managers
        console.log('🛠️ Initializing managers...');
        await Promise.all([
          this.giveawayManager.initializeGuild(targetGuild),
          this.pollManager.initializeGuild(targetGuild),
          this.quarantineManager.initializeGuild(targetGuild),
          this.ticketManager.initializeGuild(targetGuild)
        ]);

        console.log(`✅ Initialized all systems for guild: ${targetGuild.name}`);
        this.logger.info(`✅ Initialized all systems for guild: ${targetGuild.name}`);

        // Start optimized stats updates (every 5 minutes instead of constant)
        this.startOptimizedIntervals(targetGuild.id);

      } else {
        console.warn(`⚠️ Target guild ${Config.TARGET_GUILD_ID} not found`);
        this.logger.warn(`⚠️ Target guild ${Config.TARGET_GUILD_ID} not found`);
      }

      console.log('🎉 Bot initialization completed!');
      this.logger.info('🎉 Pegasus Bot is fully initialized and ready!');
      
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      this.logger.error('❌ Error during initialization:', error);
    }
  }

  private startOptimizedIntervals(guildId: string): void {
    // Stats update every 5 minutes (only if dashboard clients connected)
    const statsInterval = setInterval(async () => {
      const roomInfo = this.wsManager.getGuildRoomInfo(guildId);
      if (roomInfo.clientCount > 0) {
        const guild = this.guilds.cache.get(guildId);
        if (guild) {
          const memberCount = guild.memberCount;
          const onlineCount = guild.presences.cache.filter(p => p.status !== 'offline').size;
          this.wsManager.emitGuildStatsUpdate(guildId, { memberCount, onlineCount });
          this.logger.debug(`📊 Updated stats: ${memberCount} members, ${onlineCount} online`);
        }
      }
    }, 300000); // 5 minutes

    this.systemIntervals.set('stats', statsInterval);

    // System health check every 10 minutes
    const healthInterval = setInterval(async () => {
      try {
        await this.db.$queryRaw`SELECT 1`;
        const memUsage = process.memoryUsage();
        this.logger.debug(`💚 System healthy - Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      } catch (error) {
        this.logger.error('💔 Health check failed:', error);
      }
    }, 600000); // 10 minutes

    this.systemIntervals.set('health', healthInterval);

    console.log('✅ Started optimized intervals');
    this.logger.info('✅ Started optimized system intervals');
  }

  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Pegasus Bot...');
    this.logger.info('🛑 Shutting down Pegasus Bot...');
    
    try {
      // Clear intervals
      for (const [name, interval] of this.systemIntervals) {
        clearInterval(interval);
        console.log(`⏹️ Stopped ${name} interval`);
      }
      this.systemIntervals.clear();

      // Cleanup managers
      console.log('🧹 Cleaning up managers...');
      await Promise.all([
        this.giveawayManager.cleanup(),
        this.pollManager.cleanup(),
        this.ticketManager.cleanup(),
        this.quarantineManager.cleanup()
      ]);
      
      // Close WebSocket server
      console.log('🔌 Closing WebSocket server...');
      this.wsManager.close();
      
      // Close HTTP server
      console.log('🌐 Closing HTTP server...');
      await new Promise<void>((resolve, reject) => {
        this.httpServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Disconnect from database
      console.log('💾 Disconnecting from database...');
      await disconnectPrisma();
      
      // Destroy Discord client
      console.log('👋 Destroying Discord client...');
      this.destroy();
      
      console.log('✅ Bot shutdown complete');
      this.logger.info('✅ Bot shutdown complete.');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      this.logger.error('❌ Error during shutdown:', error);
    }
  }
}

// Create bot instance
const client = new ExtendedClient();

// Enhanced error handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT (Ctrl+C). Graceful shutdown...');
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
  Logger.error('❌ Unhandled Rejection:', { reason, promise });
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  Logger.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the bot
console.log('🎯 Starting Pegasus Bot...');
client.start().catch(error => {
  console.error('❌ Failed to start bot:', error);
  Logger.error('❌ Failed to start bot:', error);
  process.exit(1);
});

export default client;