import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { config, validateConfig } from './utils/config';
import { db } from './database/connection';
import { i18n } from './i18n';

// Import only the working commands
import * as pingCommand from './commands/utility/ping';
import * as helpCommand from './commands/utility/help';
import * as languageCommand from './commands/utility/language';

async function main() {
  try {
    // Validate configuration
    validateConfig();
    
    // Create client
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.User,
      ],
    }) as any;

    // Add config to client
    client.config = config;
    client.commands = new Collection();

    // Initialize database
    await db.init();

    // Register working commands
    client.commands.set('ping', pingCommand);
    client.commands.set('help', helpCommand);
    client.commands.set('language', languageCommand);

    // Basic event handlers
    client.once('ready', async () => {
      console.log(`✅ Bot is ready! Logged in as ${client.user?.tag}`);
      console.log(`📊 Bot is in ${client.guilds.cache.size} servers`);

      // Register slash commands
      try {
        const commands = [
          pingCommand.data.toJSON(),
          helpCommand.data.toJSON(),
          languageCommand.data.toJSON()
        ];

        await client.application?.commands.set(commands);
        console.log('✅ Slash commands registered successfully');
      } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
      }
    });

    client.on('interactionCreate', async (interaction: any) => {
      if (!interaction.isChatInputCommand()) return;

      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Command execution error:', error);
        
        const errorMessage = i18n.t('errors.generic', {
          userId: interaction.user.id,
          guildId: interaction.guildId || undefined
        });

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });

    client.on('error', (error: any) => {
      console.error('Discord client error:', error);
    });

    // Login to Discord
    await client.login(config.token);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await db.close();
      await client.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
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