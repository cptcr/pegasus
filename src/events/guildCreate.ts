
// src/events/guildCreate.ts - When the bot joins a new guild
import { Events, Guild } from 'discord.js';
import { Client, Event } from '../types';

const event: Event<typeof Events.GuildCreate> = {
  name: Events.GuildCreate,
  async execute(guild: Guild) {
    const client = guild.client as Client;
    
    console.log(`🎉 Bot joined a new guild: ${guild.name} (${guild.id})`);
    
    // Create default guild settings in database
    try {
      await client.prisma.guild.upsert({
        where: { id: guild.id },
        update: { name: guild.name },
        create: {
          id: guild.id,
          name: guild.name,
          prefix: client.config.defaultPrefix,
          enableLeveling: true,
          enableModeration: true,
          enableGeizhals: false,
          enablePolls: true,
          enableGiveaways: true,
          enableAutomod: false,
          enableTickets: false,
          enableMusic: false,
          enableJoinToCreate: false
        }
      });
      
      console.log(`✅ Created database entry for guild: ${guild.name}`);
    } catch (error) {
      console.error(`❌ Error creating database entry for guild ${guild.name}:`, error);
    }
  }
};

export default event;