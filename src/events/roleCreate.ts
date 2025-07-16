import { Events, Role } from 'discord.js';
import { loggingHandler } from '../handlers/logging';

export const event = {
  name: Events.GuildRoleCreate,
  async execute(role: Role) {
    try {
      await loggingHandler.logRoleCreate(role);
    } catch (error) {
      console.error('Error handling role create:', error);
    }
  },
};