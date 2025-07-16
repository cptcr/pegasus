import { Events, GuildChannel } from 'discord.js';
import { loggingHandler } from '../handlers/logging';

export const event = {
  name: Events.ChannelDelete,
  async execute(channel: GuildChannel) {
    try {
      await loggingHandler.logChannelDelete(channel);
    } catch (error) {
      console.error('Error handling channel delete:', error);
    }
  },
};