// src/index.ts - Pegasus Bot v2.0.0 Main Entry Point
import { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { EventHandler } from './handlers/EventHandler.js';
import { CommandHandler } from './handlers/CommandHandler.js';
import { DatabaseManager } from './database/DatabaseManager.js';
import { Logger } from './utils/Logger.js';
import { Config } from './config/Config.js';

// Load environment variables
config();

// Extended Client interface
interface ExtendedClient extends Client {
  commands: Collection<string, any>;
  cooldowns: Collection<string, Collection<string, number>>;
  db: PrismaClient;
  logger: Logger;
  config: typeof Config;
}

class PegasusBot {
  public client: ExtendedClient;
  private logger: Logger;
  private db: PrismaClient;
  private eventHandler: EventHandler;
  private commandHandler: CommandHandler;
  private databaseManager: DatabaseManager;

  constructor() {
    // Initialize logger
    this.logger = new Logger();
    
    // Initialize database
    this.db = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
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

      // Login to Discord
      await this.client.login(process.env.DISCORD_BOT_TOKEN);

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
          const command = await import(itemPath);
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

      const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

      if (process.env.NODE_ENV === 'development' && process.env.GUILD_ID) {
        // Register commands to specific guild in development
        await rest.put(
          Routes.applicationGuildCommands(Config.CLIENT_ID, process.env.GUILD_ID),
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
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('🛑 Shutting down Pegasus Bot...');
      
      // Disconnect from Discord
      this.client.destroy();
      
      // Disconnect from database
      await this.db.$disconnect();
      
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

export { ExtendedClient };
export default bot;