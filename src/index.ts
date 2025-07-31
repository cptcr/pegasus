import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { XPHandler } from './handlers/xp';
import { ExtendedClient } from './types';
import { config } from './config';
import { logger } from './utils/logger';
import { CommandHandler } from './handlers/commandHandler';
import { EventHandler } from './handlers/eventHandler';
import { reminders } from './handlers/reminders';
import { db } from './database/connection';
import { giveawayHandler } from './handlers/giveaway';
import { monetizationHandler } from './handlers/monetization';
import { BackupManager } from './utils/backup';
import { MetricsCollector } from './utils/metrics';
import { UnifiedServer } from './utils/unifiedServer';

declare global {
  var client: ExtendedClient;
}

async function main() {
  try {
    logger.info('Starting Pegasus Discord Bot...', {
      nodeVersion: process.version,
      environment: config.NODE_ENV,
    });
    
    // Create unified server instance
    let unifiedServer: UnifiedServer | null = null;
    
    // Create client
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
        Partials.ThreadMember,
      ],
    }) as ExtendedClient;

    // Add config to client
    client.config = {
      token: config.BOT_TOKEN,
      clientId: config.CLIENT_ID,
      databaseUrl: config.DATABASE_URL,
      nodeEnv: config.NODE_ENV,
    };
    
    // Set global client reference
    global.client = client;

    // Initialize handlers
    const commandHandler = new CommandHandler(client);
    const eventHandler = new EventHandler(client);
    const backupManager = new BackupManager();
    const metricsCollector = new MetricsCollector(client);

    // Initialize database with retry logic
    let dbInitialized = false;
    let retries = 0;
    const maxRetries = 5;
    
    while (!dbInitialized && retries < maxRetries) {
      try {
        await db.init();
        dbInitialized = true;
        logger.info('Database initialized successfully');
      } catch (error) {
        retries++;
        logger.error(`Database initialization failed (attempt ${retries}/${maxRetries})`, error as Error);
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000 * retries));
        } else {
          throw new Error('Failed to initialize database after maximum retries');
        }
      }
    }

    // Load commands and events
    await commandHandler.loadCommands();
    await eventHandler.loadEvents();

    // Initialize reminder system
    if (config.isFeatureEnabled('enableReminders')) {
      reminders.setClient(client);
      logger.info('Reminder system initialized');
    }
    
    // Start unified server (health check + monitoring dashboard on same port)
    unifiedServer = new UnifiedServer(client as any, config.DYNAMIC_PORT);
    const serverPort = await unifiedServer.start();
    logger.info(`Unified API server started on port ${serverPort}`);
    
    // Export the port for other services to use
    process.env.PEGASUS_API_PORT = serverPort.toString();
    
    // Start metrics collection
    if (config.ENABLE_PROMETHEUS) {
      await metricsCollector.start();
    }
    
    // Start backup system
    if (config.ENABLE_AUTO_BACKUP) {
      await backupManager.start();
    }

    // Login to Discord
    await client.login(config.BOT_TOKEN);

    // Register commands after login
    client.once('ready', async () => {
      logger.info(`Bot logged in as ${client.user?.tag}`, {
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
      });
      
      await commandHandler.registerCommands();
      
      // Initialize scheduled giveaways
      if (config.isFeatureEnabled('enableGiveaways')) {
        await giveawayHandler.initializeScheduledGiveaways();
      }
      
      // Start Discord monetization polling
      if (config.ENABLE_PREMIUM) {
        monetizationHandler.startEntitlementPolling();
        logger.info('Discord monetization polling started');
      }
      
      // Log successful startup
      logger.audit('BOT_STARTED', client.user?.id || 'unknown', 'system', {
        version: process.env.npm_package_version || '1.0.0',
        shardId: client.shard?.ids[0] || 0,
      });
    });

    // Enhanced error handling
    client.on('error', (error) => {
      logger.error('Discord client error', error);
    });
    
    client.on('warn', (warning) => {
      logger.warn('Discord client warning', { warning });
    });
    
    client.on('shardError', (error, shardId) => {
      logger.error('Discord shard error', error, { shardId });
    });
    
    client.on('shardReconnecting', (shardId) => {
      logger.info('Discord shard reconnecting', { shardId });
    });
    
    client.on('shardReady', (shardId) => {
      logger.info('Discord shard ready', { shardId });
    });
    
    client.on('shardDisconnect', (event, shardId) => {
      logger.warn('Discord shard disconnected', { shardId, code: event.code, reason: event.reason });
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        // Stop accepting new tasks
        reminders.stop();
        monetizationHandler.stopEntitlementPolling();
        backupManager.stop();
        metricsCollector.stop();
        
        // Wait for ongoing operations to complete (max 30 seconds)
        const shutdownTimeout = setTimeout(() => {
          logger.error('Graceful shutdown timeout reached, forcing exit');
          process.exit(1);
        }, 30000);
        
        // Close database connections
        await db.close();
        
        // Destroy Discord client
        await client.destroy();
        
        clearTimeout(shutdownTimeout);
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught errors (already logged by logger)
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', reason as Error, { promise });
    });

  } catch (error) {
    logger.error('Failed to start bot', error as Error);
    process.exit(1);
  }
}

// Start the bot
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});