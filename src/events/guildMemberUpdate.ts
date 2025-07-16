import { Events, GuildMember } from 'discord.js';
import { loggingHandler } from '../handlers/logging';

export const event = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember, newMember: GuildMember) {
    try {
      await loggingHandler.logMemberUpdate(oldMember, newMember);
    } catch (error) {
      console.error('Error handling member update:', error);
    }
  },
};