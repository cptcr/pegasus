import { Events, GuildMember } from 'discord.js';
import { loggingHandler } from '../handlers/logging';
import { statsHandler } from '../handlers/stats';
import { welcomeHandler } from '../handlers/welcome';

export const event = {
  name: Events.GuildMemberRemove,
  async execute(member: GuildMember) {
    try {
      // Handle goodbye messages
      await welcomeHandler.handleMemberLeave(member);
      
      // Log member leave
      await loggingHandler.logMemberLeave(member);
      
      // Update statistics
      await statsHandler.incrementMemberLeave(member.guild.id);
    } catch (error) {
      console.error('Error handling member leave:', error);
    }
  },
};