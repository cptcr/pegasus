import { Events, Message } from 'discord.js';
import { loggingHandler } from '../handlers/logging';

export const event = {
  name: Events.MessageDelete,
  async execute(message: Message) {
    if (message.partial) {
      try {
        await message.fetch();
      } catch (error) {
        console.error('Error fetching deleted message:', error);
        return;
      }
    }

    try {
      await loggingHandler.logMessageDelete(message);
    } catch (error) {
      console.error('Error logging message delete:', error);
    }
  },
};