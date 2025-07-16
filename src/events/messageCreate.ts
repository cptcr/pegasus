import { Events, Message } from 'discord.js';
import { xpHandler } from '../handlers/xp';
import { statsHandler } from '../handlers/stats';
import { autoModHandler } from '../handlers/automod';

export const event = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (message.author.bot || !message.guild) return;

    try {
      // Handle automod first (may delete message)
      await autoModHandler.handleMessage(message);
      
      // Only continue if message wasn't deleted
      if (!message.deletable) return;
      
      // Handle XP system
      await xpHandler.handleMessage(message);
      
      // Track message statistics
      await statsHandler.incrementMessageCount(message.guild.id, message.author.id);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  },
};