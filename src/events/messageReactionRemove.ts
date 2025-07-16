import { Events, MessageReaction, User } from 'discord.js';
import { reactionRolesHandler } from '../handlers/reactionRoles';

export const event = {
  name: Events.MessageReactionRemove,
  async execute(reaction: MessageReaction, user: User) {
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('Error fetching reaction:', error);
        return;
      }
    }

    try {
      await reactionRolesHandler.handleReactionRemove(reaction, user);
    } catch (error) {
      console.error('Error handling reaction remove:', error);
    }
  },
};