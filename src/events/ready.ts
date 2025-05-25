
// src/events/ready.ts - Bot ready event
import { Events } from 'discord.js';
import { Client, Event } from '../types';

const event: Event<typeof Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    
    // Set bot activity
    client.user.setActivity('/help | !help', { type: 3 }); // 3 = Watching
    
    // Log some stats
    console.log(`🌐 Connected to ${client.guilds.cache.size} guilds`);
    console.log(`👥 Serving ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} users`);
    
    // Initialize database connection
    try {
      await client.prisma.$connect();
      console.log('📊 Database connection established');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
    }
  }
};

export default event;