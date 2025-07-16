import { Events, Message } from 'discord.js';
import { loggingHandler } from '../handlers/logging';

export const event = {
  name: Events.MessageUpdate,
  async execute(oldMessage: Message, newMessage: Message) {
    if (newMessage.partial) {
      try {
        await newMessage.fetch();
      } catch (error) {
        console.error('Error fetching updated message:', error);
        return;
      }
    }

    try {
      await loggingHandler.logMessageUpdate(oldMessage, newMessage);
    } catch (error) {
      console.error('Error logging message update:', error);
    }
  },
};