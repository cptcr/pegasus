import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import chalk from 'chalk';

export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = join(__dirname, '..', 'events');
  const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of eventFiles) {
    try {
      const filePath = join(eventsPath, file);
      const eventModule = await import(filePath) as { 
        name?: string; 
        once?: boolean; 
        execute?: (...args: unknown[]) => Promise<void> | void 
      };
      
      if (!eventModule.name || !eventModule.execute) {
        logger.warn(chalk.yellow(`Event at ${filePath} is missing required "name" or "execute" property`));
        continue;
      }
      
      if (eventModule.once) {
        client.once(eventModule.name, (...args) => void eventModule.execute!(...args));
      } else {
        client.on(eventModule.name, (...args) => void eventModule.execute!(...args));
      }
      
      logger.info(chalk.green(`Loaded event: ${eventModule.name}`));
    } catch (error) {
      logger.error(chalk.red(`Failed to load event ${file}:`), error);
    }
  }
}