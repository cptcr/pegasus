import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import chalk from 'chalk';

type EventModule = {
  name?: string;
  once?: boolean;
  execute?: (...args: unknown[]) => Promise<void> | void;
};

export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = join(__dirname, '..', 'events');
  const eventFiles = readdirSync(eventsPath).filter(
    file => file.endsWith('.ts') || file.endsWith('.js')
  );

  for (const file of eventFiles) {
    try {
      const filePath = join(eventsPath, file);
      const module = (await import(filePath)) as EventModule;

      if (!module.name || !module.execute) {
        logger.warn(
          chalk.yellow(`Event at ${filePath} is missing required "name" or "execute" property`)
        );
        continue;
      }

      // Fix unsafe spread by properly typing the args
      const typedExecute = module.execute as (...args: unknown[]) => Promise<void> | void;

      if (module.once) {
        client.once(module.name, (...args: unknown[]) => {
          void typedExecute(...args);
        });
      } else {
        client.on(module.name, (...args: unknown[]) => {
          void typedExecute(...args);
        });
      }

      logger.info(chalk.green(`Loaded event: ${module.name}`));
    } catch (error) {
      logger.error(chalk.red(`Failed to load event ${file}:`), error);
    }
  }
}
