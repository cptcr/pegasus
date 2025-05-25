// src/index.ts - Main entry point for the bot
import { config } from 'dotenv';
import { Client, GatewayIntentBits, Partials, Collection, Events } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { registerCommands } from './commands';
import { registerEvents } from './events';
import { loadFeatures } from './features';
import { BotConfig } from './types';

// Load environment variables
config();

// Create Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
});

// Initialize Prisma
const prisma = new PrismaClient();

// Bot configuration object
const botConfig: BotConfig = {
  devGuilds: process.env.NODE_ENV === 'development' 
    ? (process.env.DEV_GUILDS || '').split(',').filter(Boolean)
    : [],
  devUsers: (process.env.DEV_USERS || '').split(',').filter(Boolean),
  devRoles: (process.env.DEV_ROLES || '').split(',').filter(Boolean),
  defaultPrefix: '!',
  enabledFeatures: {
    leveling: process.env.ENABLE_LEVELING !== 'false',
    moderation: process.env.ENABLE_MODERATION !== 'false',
    geizhals: process.env.ENABLE_GEIZHALS === 'true',
    polls: process.env.ENABLE_POLLS !== 'false',
    giveaways: process.env.ENABLE_GIVEAWAYS !== 'false',
    tickets: process.env.ENABLE_TICKETS === 'true',
    music: process.env.ENABLE_MUSIC === 'true',
    joinToCreate: process.env.ENABLE_JOIN_TO_CREATE === 'true',
  },
  debug: process.env.DEBUG === 'true',
};

// Initialize collections on the client
client.commands = new Collection();
client.slashCommands = new Collection();
client.cooldowns = new Collection();
client.config = botConfig;
client.prisma = prisma;

// Register event handlers
registerEvents(client);

// Register commands (both slash and prefix)
registerCommands(client);

// Load all features
loadFeatures(client);

// Login to Discord with the bot token
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => {
    console.log(`🤖 Bot logged in as ${client.user?.tag}`);
  })
  .catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
  });

// Handle process termination
const handleExit = async () => {
  console.log('Shutting down...');
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});