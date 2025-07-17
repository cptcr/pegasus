import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { ExtendedClient } from './types';
import { config, validateConfig } from './utils/config';
import { CommandHandler } from './handlers/commandHandler';
import { EventHandler } from './handlers/eventHandler';
import { reminders } from './handlers/reminders';
import { db } from './database/connection';
import { giveawayHandler } from './handlers/giveaway';

declare global {
  var client: ExtendedClient;
}

async function main() {
  try {
    // Validate configuration
    validateConfig();
    
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
    client.config = config;

    // Initialize handlers
    const commandHandler = new CommandHandler(client);
    const eventHandler = new EventHandler(client);

    // Initialize database
    await db.init();

    // Load commands and events
    await commandHandler.loadCommands();
    await eventHandler.loadEvents();

    // Initialize reminder system (skip for now due to DB timeout issues)
    // reminders.setClient(client);

    // Login to Discord
    await client.login(config.token);

    // Register commands after login
    client.once('ready', async () => {
      await commandHandler.registerCommands();
      
      // Initialize scheduled giveaways
      await giveawayHandler.initializeScheduledGiveaways();
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      reminders.stop();
      await db.close();
      await client.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      reminders.stop();
      await db.close();
      await client.destroy();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();