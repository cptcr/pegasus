import { Events, GuildMember } from 'discord.js';
import { loggingHandler } from '../handlers/logging';
import { statsHandler } from '../handlers/stats';
import { welcomeHandler } from '../handlers/welcome';

export const event = {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember) {
    try {
      // Handle welcome messages and autoroles
      await welcomeHandler.handleMemberJoin(member);
      
      // Log member join
      await loggingHandler.logMemberJoin(member);
      
      // Update statistics
      await statsHandler.incrementMemberJoin(member.guild.id);
    } catch (error) {
      console.error('Error handling member join:', error);
    }
  },
};