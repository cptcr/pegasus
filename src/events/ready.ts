import { Events, Client, ActivityType } from 'discord.js';
import { logger } from '../utils/logger';
import { giveawayService } from '../services/giveawayService';
import chalk from 'chalk';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>) {
  logger.info(chalk.green(`Ready! Logged in as ${client.user.tag}`));
  
  // Store client globally for giveaway service
  const globalObj = global as { client?: Client };
  globalObj.client = client;
  
  // Initialize active giveaways
  await giveawayService.initializeActiveGiveaways();
  logger.info(chalk.blue('Initialized active giveaways'));
  
  // Set bot status
  client.user.setPresence({
    activities: [{
      name: `${client.guilds.cache.size} servers`,
      type: ActivityType.Watching,
    }],
    status: 'online',
  });

  // Update status every 5 minutes
  setInterval(() => {
    const activities = [
      { name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching },
      { name: `${client.users.cache.size} users`, type: ActivityType.Listening },
      { name: '/help for commands', type: ActivityType.Playing },
    ];

    const activity = activities[Math.floor(Math.random() * activities.length)];
    client.user.setActivity(activity.name, { type: activity.type as ActivityType });
  }, 300000); // 5 minutes
}