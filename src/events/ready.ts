// src/events/ready.ts - Fixed Ready Event
import { ActivityType } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { Config } from '../config/Config.js';
import { BotEvent } from '../types/index.js';

const event: BotEvent<'ready'> = {
  name: 'ready',
  once: true,
  async execute(client: ExtendedClient) {
    if (!client.user) {
      client.logger.error('❌ Bot user is null in ready event');
      return;
    }

    console.log(`✅ Logged in as ${client.user.tag}`);
    client.logger.info(`🤖 Bot ready! Logged in as ${client.user.tag}`);
    
    // Set bot activity
    client.user.setActivity({
      name: `${client.guilds.cache.size} servers | /help`,
      type: ActivityType.Watching
    });

    // Initialize all managers and systems
    await client.init();
    
    // Log final startup information
    client.logger.info('🎉 Pegasus Bot is fully initialized and ready!');
    client.logger.info(`📊 Connected to ${client.guilds.cache.size} guilds`);
    client.logger.info(`👥 Serving ${client.users.cache.size} users`);
    client.logger.info(`⚡ Loaded ${client.commands.size} commands`);

    // Emit ready event to dashboard
    client.wsManager.broadcastGeneralEvent('bot:ready', {
      tag: client.user.tag,
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      commands: client.commands.size,
      uptime: client.uptime || 0
    });
  },
};

export default event;