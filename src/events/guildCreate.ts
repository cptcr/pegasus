import { Events, Guild } from 'discord.js';
import { guildService } from '../services/guildService';
import { logger } from '../utils/logger';
import chalk from 'chalk';

export const name = Events.GuildCreate;

export async function execute(guild: Guild) {
  logger.info(chalk.green(`Joined new guild: ${guild.name} (${guild.id})`));
  
  try {
    // Ensure guild exists in database
    await guildService.ensureGuild(guild);
    
    // Log guild statistics
    logger.info(`Guild members: ${guild.memberCount}`);
    logger.info(`Guild owner: ${guild.ownerId}`);
    logger.info(`Guild created: ${guild.createdAt.toISOString()}`);
  } catch (error) {
    logger.error(`Failed to process guild join for ${guild.id}:`, error);
  }
}