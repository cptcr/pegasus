import { Client, REST, Routes, Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import type { Command } from '../types/command';

export async function loadCommands(client: Client): Promise<void> {
  const commands = [];
  const commandsPath = join(__dirname, '..', 'commands');
  const commandCategories = readdirSync(commandsPath);

  for (const category of commandCategories) {
    const categoryPath = join(commandsPath, category);
    const commandFiles = readdirSync(categoryPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    for (const file of commandFiles) {
      try {
        const filePath = join(categoryPath, file);
        const command = await import(filePath);
        
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command as Command);
          commands.push(command.data.toJSON());
          logger.info(chalk.green(`Loaded command: ${command.data.name} (${category})`));
        } else {
          logger.warn(chalk.yellow(`Command at ${filePath} is missing required "data" or "execute" property`));
        }
      } catch (error) {
        logger.error(chalk.red(`Failed to load command ${file}:`), error);
      }
    }
  }

  // Register commands with Discord
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    
    if (process.env.NODE_ENV === 'development' && process.env.GUILD_ID) {
      // Register commands to a specific guild for development
      await rest.put(
        Routes.applicationGuildCommands(client.user!.id, process.env.GUILD_ID),
        { body: commands }
      );
      logger.info(chalk.green(`Registered ${commands.length} commands to guild ${process.env.GUILD_ID}`));
    } else {
      // Register commands globally for production
      await rest.put(
        Routes.applicationCommands(client.user!.id),
        { body: commands }
      );
      logger.info(chalk.green(`Registered ${commands.length} commands globally`));
    }
  } catch (error) {
    logger.error(chalk.red('Failed to register commands:'), error);
    throw error;
  }
}