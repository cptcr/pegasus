import { Events, VoiceState } from 'discord.js';
import { xpHandler } from '../handlers/xp';
import { joinToCreateHandler } from '../handlers/joinToCreate';
import { loggingHandler } from '../handlers/logging';

export const event = {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState) {
    try {
      // Handle XP system
      await xpHandler.handleVoiceStateUpdate(oldState, newState);
      
      // Handle join to create channels
      await joinToCreateHandler.handleVoiceStateUpdate(oldState, newState);
      
      // Handle logging
      await loggingHandler.logVoiceStateUpdate(oldState, newState);
    } catch (error) {
      console.error('Error handling voice state update:', error);
    }
  },
};