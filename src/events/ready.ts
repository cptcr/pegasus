// src/events/ready.ts
import { ActivityType } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { Config } from '../config/Config.js';

export default {
  name: 'ready',
  once: true,
  async execute(client: ExtendedClient) {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    client.user?.setActivity('over the server', { type: ActivityType.Watching });

    // Initialize all managers on ready
    client.giveawayManager.init();
    client.pollManager.init();
    
    // Initial fetch and periodic update for guild stats
    const updateGuildStats = async () => {
      try {
        const guild = await client.guilds.fetch(Config.TARGET_GUILD_ID);
        if (!guild) return;

        // Fetch member counts
        await guild.members.fetch();
        const memberCount = guild.memberCount;
        const onlineCount = guild.presences.cache.filter(p => p.status !== 'offline').size;

        const stats = {
          memberCount,
          onlineCount,
        };

        // Emit to dashboard
        client.wsManager.emitRealtimeEvent(guild.id, 'guild:stats:updated', stats);
      } catch (error) {
        client.logger.error('Failed to fetch and emit guild stats:', error);
      }
    };
    
    // Run once on startup, then every 5 minutes
    updateGuildStats();
    setInterval(updateGuildStats, 5 * 60 * 1000); // 5 minutes
  },
};