// src/index.ts - Fixed Pegasus Bot v2.0.0 Main Entry Point
import { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  ActivityType, 
  REST, 
  Routes 
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { EventHandler} from './handlers/EventHandler.js';
import { CommandHandler } from './handlers/CommandHandler.js';
import { DatabaseManager } from './database/DatabaseManager.js';
import { Logger } from './utils/Logger.js';
import { Config, validateConfig } from './config/Config.js';
import { WebSocketManager } from './api/WebSocketManager.js';
import { createServer } from 'http';

// Load environment variables
config();

// Extended Client interface
export interface ExtendedClient extends Client {
  commands: Collection<string, any>;
  cooldowns: Collection<string, Collection<string, number>>;
  db: PrismaClient;
  logger: Logger;
  config: typeof Config;
  wsManager?: WebSocketManager;
}

class PegasusBot {
  public client: ExtendedClient;
  private logger: Logger;
  private db: PrismaClient;
  private eventHandler: EventHandler;
  private commandHandler: CommandHandler;
  private databaseManager: DatabaseManager;
  private wsManager?: WebSocketManager;
  private httpServer?: any;

  constructor() {
    // Validate configuration first
    const configValidation = validateConfig();
    if (!configValidation.valid) {
      console.error('❌ Configuration validation failed:');
      configValidation.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }

    // Initialize logger
    this.logger = new Logger();
    
    // Initialize database
    this.db = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: 'pretty'
    });

    // Initialize Discord client with required intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages
      ],
      presence: {
        activities: [{
          name: 'Pegasus v2.0.0 | /help',
          type: ActivityType.Playing
        }],
        status: 'online'
      }
    }) as ExtendedClient;

    // Add extended properties
    this.client.commands = new Collection();
    this.client.cooldowns = new Collection();
    this.client.db = this.db;
    this.client.logger = this.logger;
    this.client.config = Config;

    // Initialize managers
    this.databaseManager = new DatabaseManager(this.db, this.logger);
    this.eventHandler = new EventHandler(this.client, this.logger);
    this.commandHandler = new CommandHandler(this.client, this.logger);
  }

  /**
   * Initialize the bot
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Pegasus Bot v2.0.0...');

      // Connect to database
      await this.connectDatabase();

      // Load commands
      await this.loadCommands();

      // Register slash commands
      await this.registerSlashCommands();

      // Load events
      await this.loadEvents();

      // Initialize WebSocket server if enabled
      if (Config.FEATURES.ENABLE_WEB_DASHBOARD) {
        await this.initializeWebSocket();
      }

      // Login to Discord
      await this.client.login(Config.BOT_TOKEN);

      this.logger.success('✅ Pegasus Bot started successfully!');
      
    } catch (error) {
      this.logger.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }

  /**
   * Connect to the database
   */
  private async connectDatabase(): Promise<void> {
    try {
      await this.db.$connect();
      this.logger.success('✅ Database connected successfully');
      
      // Initialize database manager
      await this.databaseManager.initialize();
      
    } catch (error) {
      this.logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Load all commands from the commands directory
   */
  private async loadCommands(): Promise<void> {
    try {
      const commandsPath = path.join(process.cwd(), 'src', 'commands');
      
      if (!fs.existsSync(commandsPath)) {
        this.logger.warn('⚠️ Commands directory not found');
        return;
      }

      await this.loadCommandsFromDirectory(commandsPath);
      
      this.logger.success(`✅ Loaded ${this.client.commands.size} commands`);
      
    } catch (error) {
      this.logger.error('❌ Failed to load commands:', error);
      throw error;
    }
  }

  /**
   * Recursively load commands from directory
   */
  private async loadCommandsFromDirectory(dirPath: string): Promise<void> {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        await this.loadCommandsFromDirectory(itemPath);
      } else if (item.endsWith('.ts') || item.endsWith('.js')) {
        try {
          // Convert to file URL for ES modules
          const fileUrl = `file://${itemPath.replace(/\\/g, '/')}`;
          const command = await import(fileUrl);
          const commandData = command.default || command;

          if (commandData.data && commandData.execute) {
            this.client.commands.set(commandData.data.name, commandData);
            this.logger.debug(`📄 Loaded command: ${commandData.data.name}`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to load command ${item}:`, error);
        }
      }
    }
  }

  /**
   * Register slash commands with Discord
   */
  private async registerSlashCommands(): Promise<void> {
    try {
      const commands = [];
      
      for (const command of this.client.commands.values()) {
        if (command.data) {
          commands.push(command.data.toJSON());
        }
      }

      const rest = new REST().setToken(Config.BOT_TOKEN);

      if (process.env.NODE_ENV === 'development' && Config.DEV.GUILD_ID) {
        // Register commands to specific guild in development
        await rest.put(
          Routes.applicationGuildCommands(Config.CLIENT_ID, Config.DEV.GUILD_ID),
          { body: commands }
        );
        this.logger.success(`✅ Registered ${commands.length} guild commands`);
      } else {
        // Register commands globally in production
        await rest.put(
          Routes.applicationCommands(Config.CLIENT_ID),
          { body: commands }
        );
        this.logger.success(`✅ Registered ${commands.length} global commands`);
      }

    } catch (error) {
      this.logger.error('❌ Failed to register slash commands:', error);
      throw error;
    }
  }

  /**
   * Load all events
   */
  private async loadEvents(): Promise<void> {
    try {
      await this.eventHandler.loadEvents();
      this.logger.success('✅ Events loaded successfully');
    } catch (error) {
      this.logger.error('❌ Failed to load events:', error);
      throw error;
    }
  }

  /**
   * Initialize WebSocket server for dashboard
   */
  private async initializeWebSocket(): Promise<void> {
    try {
      this.httpServer = createServer();
      this.wsManager = new WebSocketManager(this.httpServer, this.client, this.logger);
      this.client.wsManager = this.wsManager;

      this.httpServer.listen(Config.API.WEBSOCKET_PORT, () => {
        this.logger.success(`✅ WebSocket server listening on port ${Config.API.WEBSOCKET_PORT}`);
      });
    } catch (error) {
      this.logger.error('❌ Failed to initialize WebSocket server:', error);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('🛑 Shutting down Pegasus Bot...');
      
      // Close WebSocket server
      if (this.wsManager) {
        this.wsManager.close();
      }

      if (this.httpServer) {
        this.httpServer.close();
      }
      
      // Disconnect from Discord
      this.client.destroy();
      
      // Disconnect from database
      await this.db.$disconnect();
      
      // Close logger
      this.logger.close();
      
      this.logger.success('✅ Bot shutdown complete');
      process.exit(0);
      
    } catch (error) {
      this.logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Initialize and start the bot
const bot = new PegasusBot();

// Handle graceful shutdown
process.on('SIGINT', () => bot.shutdown());
process.on('SIGTERM', () => bot.shutdown());

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Start the bot
bot.initialize().catch(console.error);

export default bot;