// src/events/ready.ts - Bot Ready Event
import { Events, Guild } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { GiveawayManager } from '../modules/giveaways/GiveawayManager.js';
import { PollManager } from '../modules/polls/PollManager.js';
import { QuarantineManager } from '../modules/quarantine/QuarantineManager.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: ExtendedClient) {
    client.logger.success(`✅ ${client.user?.tag} is now online!`);
    client.logger.info(`📊 Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`);

    // Initialize managers for all guilds
    const giveawayManager = new GiveawayManager(client, client.db, client.logger);
    const pollManager = new PollManager(client, client.db, client.logger);
    const quarantineManager = new QuarantineManager(client, client.db, client.logger);

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        // Ensure guild exists in database
        await client.db.guild.upsert({
          where: { id: guildId },
          update: { name: guild.name },
          create: {
            id: guildId,
            name: guild.name
          }
        });

        // Initialize systems for each guild
        await giveawayManager.initializeGuild(guild);
        await pollManager.initializeGuild(guild);
        await quarantineManager.initializeGuild(guild);

        client.logger.debug(`Initialized systems for guild: ${guild.name}`);
      } catch (error) {
        client.logger.error(`Failed to initialize guild ${guild.name}:`, error);
      }
    }

    client.logger.success('🎯 All systems initialized successfully!');
  }
};
