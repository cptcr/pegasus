import { Events, Role } from 'discord.js';
import { loggingHandler } from '../handlers/logging';

export const event = {
  name: Events.GuildRoleDelete,
  async execute(role: Role) {
    try {
      await loggingHandler.logRoleDelete(role);
    } catch (error) {
      console.error('Error handling role delete:', error);
    }
  },
};