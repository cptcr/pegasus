// src/commands/index.ts - Command registration
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { Client, SlashCommand, PrefixCommand } from '../types';

export async function registerCommands(client: Client): Promise<void> {
  const commands: SlashCommand[] = [];
  const prefixCommands: PrefixCommand[] = [];

  // Load slash commands
  const slashCommandsPath = path.join(__dirname, 'slash');
  const slashCommandFiles = fs.readdirSync(slashCommandsPath).filter(file => 
    file.endsWith('.js') || file.endsWith('.ts')
  );

  for (const file of slashCommandFiles) {
    const filePath = path.join(slashCommandsPath, file);
    const command = require(filePath).default as SlashCommand;
    
    if (!command.data || !command.execute) {
      console.warn(`⚠️ The slash command at ${filePath} is missing required "data" or "execute" property.`);
      continue;
    }

    // Skip disabled commands
    if (command.enabled === false) {
      continue;
    }

    // Register for internal use
    client.slashCommands.set(command.data.name, command);
    commands.push(command);
  }

  // Load prefix commands
  const prefixCommandsPath = path.join(__dirname, 'prefix');
  const prefixCommandFolders = fs.readdirSync(prefixCommandsPath);

  for (const folder of prefixCommandFolders) {
    const folderPath = path.join(prefixCommandsPath, folder);
    
    // Skip if not a directory
    if (!fs.statSync(folderPath).isDirectory()) {
      continue;
    }

    const commandFiles = fs.readdirSync(folderPath).filter(file => 
      file.endsWith('.js') || file.endsWith('.ts')
    );

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath).default as PrefixCommand;
      
      if (!command.name || !command.execute) {
        console.warn(`⚠️ The prefix command at ${filePath} is missing required "name" or "execute" property.`);
        continue;
      }

      // Skip disabled commands
      if (command.enabled === false) {
        continue;
      }

      // Add category based on folder name
      command.category = command.category || folder;

      // Register for internal use
      client.commands.set(command.name, command);
      prefixCommands.push(command);
    }
  }

  // Register slash commands with Discord API
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN || '');

  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

    const commandsData = commands.map(cmd => cmd.data.toJSON());

    if (process.env.NODE_ENV === 'production' && process.env.DEPLOY_COMMANDS === 'true') {
      // Global registration in production
      await rest.put(
        Routes.applicationCommands(client.user!.id),
        { body: commandsData },
      );
      console.log(`🌐 Successfully registered ${commands.length} global application commands.`);
    } else {
      // Guild-specific registration in development
      for (const guildId of client.config.devGuilds) {
        await rest.put(
          Routes.applicationGuildCommands(client.user!.id, guildId),
          { body: commandsData },
        );
      }
      console.log(`🔧 Successfully registered ${commands.length} guild-specific application commands in ${client.config.devGuilds.length} development guilds.`);
    }
  } catch (error) {
    console.error('❌ Error registering application commands:', error);
  }

  console.log(`📝 Loaded ${client.commands.size} prefix commands across ${prefixCommands.length} categories.`);
  console.log(`🔍 Loaded ${client.slashCommands.size} slash commands.`);
}