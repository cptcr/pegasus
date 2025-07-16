import { Events, GuildChannel } from 'discord.js';
import { loggingHandler } from '../handlers/logging';

export const event = {
  name: Events.ChannelCreate,
  async execute(channel: GuildChannel) {
    try {
      await loggingHandler.logChannelCreate(channel);
    } catch (error) {
      console.error('Error handling channel create:', error);
    }
  },
};