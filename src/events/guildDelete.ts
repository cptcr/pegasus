import { Events, Guild } from 'discord.js';
import { guildService } from '../services/guildService';
import { logger } from '../utils/logger';
import chalk from 'chalk';

export const name = Events.GuildDelete;

export async function execute(guild: Guild) {
  logger.info(chalk.red(`Left guild: ${guild.name} (${guild.id})`));

  try {
    // Optionally delete guild data
    if (process.env.DELETE_DATA_ON_LEAVE === 'true') {
      await guildService.deleteGuild(guild.id);
      logger.info(`Deleted data for guild ${guild.id}`);
    }
  } catch (error) {
    logger.error(`Failed to process guild leave for ${guild.id}:`, error);
  }
}
