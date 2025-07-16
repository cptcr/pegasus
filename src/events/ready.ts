import { Events } from 'discord.js';
import { ExtendedClient } from '../types';
import { db } from '../database/connection';

export const event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: ExtendedClient) {
    console.log(`Ready! Logged in as ${client.user?.tag}`);
    
    // Initialize database
    await db.init();
    
    // Set presence
    client.user?.setActivity('with Discord.js', { type: 0 });
    
    // Set global client reference
    global.client = client;
    
    console.log(`Bot is ready and serving ${client.guilds.cache.size} servers`);
  },
};