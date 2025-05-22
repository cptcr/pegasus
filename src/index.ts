// src/index.ts
import { config } from 'dotenv';
config();

import { Client, GatewayIntentBits, Partials, ActivityType, REST, Routes } from 'discord.js';
import { DatabaseService } from './lib/database';
import { startCronJobs, startPerformanceMonitoring } from './services/cronJobs';
import { readdirSync } from 'fs';
import { join } from 'path';

// Create Discord client
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Store commands for deployment
const commands: any[] = [];

// Command handling
const commandFiles = readdirSync(join(__dirname, 'commands'), { recursive: true, withFileTypes: true })
  .filter(dirent => dirent.isFile() && dirent.name.endsWith('.ts'))
  .map(dirent => join(dirent.path, dirent.name));

for (const file of commandFiles) {
  try {
    const command = require(file);
    if (command.data && command.run) {
      commands.push(command.data.toJSON());
      console.log(`✅ Loaded command: ${command.data.name}`);
    }
  } catch (error) {
    console.error(`❌ Error loading command ${file}:`, error);
  }
}

// Event handling
const eventFiles = readdirSync(join(__dirname, 'events'))
  .filter(file => file.endsWith('.ts'));

for (const file of eventFiles) {
  try {
    const event = require(join(__dirname, 'events', file));
    
    // Handle multiple events in one file
    const eventHandlers = Object.values(event).filter((handler: any) => 
      handler && typeof handler === 'object' && handler.name && handler.execute
    );

    for (const eventHandler of eventHandlers) {
      const handler = eventHandler as any;
      if (handler.once) {
        client.once(handler.name, (...args) => handler.execute(...args));
      } else {
        client.on(handler.name, (...args) => handler.execute(...args));
      }
      console.log(`✅ Loaded event: ${handler.name}`);
    }
  } catch (error) {
    console.error(`❌ Error loading event ${file}:`, error);
  }
}

// Bot ready event
client.once('ready', async () => {
  console.log(`🤖 ${client.user?.tag} is online!`);
  
  // Set bot activity
  client.user?.setActivity('Managing your server', { type: ActivityType.Playing });
  
  // Deploy commands
  if (process.env.NODE_ENV === 'development' || process.env.DEPLOY_COMMANDS === 'true') {
    await deployCommands();
  }
  
  // Initialize database
  try {
    await DatabaseService.initialize();
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
  
  // Start cron jobs
  startCronJobs();
  startPerformanceMonitoring();
  
  // Start dashboard if enabled
  if (process.env.ENABLE_WEB_DASHBOARD !== 'false') {
    startDashboard();
  }
  
  console.log('🚀 Bot fully initialized and ready!');
});

// Command interaction handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const commandName = interaction.commandName;
  
  try {
    // Find and execute command
    for (const file of commandFiles) {
      const command = require(file);
      if (command.data?.name === commandName) {
        await command.run({ interaction, client });
        return;
      }
    }
    
    await interaction.reply({
      content: '❌ Command not found.',
      ephemeral: true
    });
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    
    const errorMessage = {
      content: '❌ An error occurred while executing this command.',
      ephemeral: true
    };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Error handling
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord client warning:', warning);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

async function cleanup() {
  try {
    console.log('🧹 Cleaning up...');
    
    // Disconnect Discord client
    if (client.isReady()) {
      await client.destroy();
      console.log('✅ Discord client disconnected');
    }
    
    // Disconnect database
    await DatabaseService.disconnect();
    console.log('✅ Database disconnected');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Deploy slash commands
async function deployCommands() {
  try {
    console.log('🔄 Deploying slash commands...');
    
    const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);
    
    if (process.env.TARGET_GUILD_ID) {
      // Deploy to specific guild (development)
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.TARGET_GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Successfully deployed ${commands.length} commands to guild ${process.env.TARGET_GUILD_ID}`);
    } else {
      // Deploy globally (production)
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commands }
      );
      console.log(`✅ Successfully deployed ${commands.length} commands globally`);
    }
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

// Start dashboard
function startDashboard() {
  if (process.env.NODE_ENV === 'production') {
    // In production, dashboard is started by concurrently
    console.log('🌐 Dashboard will be started by process manager');
  } else {
    // In development, start dashboard separately
    console.log('🌐 Dashboard should be started separately with: npm run dev:dashboard');
  }
}

// Health check endpoint for Docker
if (process.env.NODE_ENV === 'production') {
  const http = require('http');
  const healthServer = http.createServer((req: any, res: any) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        discord: client.isReady() ? 'connected' : 'disconnected'
      }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  
  healthServer.listen(process.env.PORT || 3000, () => {
    console.log(`🏥 Health check server running on port ${process.env.PORT || 3000}`);
  });
}

// Login to Discord
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN)
  .catch((error) => {
    console.error('❌ Failed to login to Discord:', error);
    process.exit(1);
  });