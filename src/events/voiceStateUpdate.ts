// src/events/voiceStateUpdate.ts - Fixed Voice State Update Event Handler
import { VoiceState } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { BotEvent } from '../types/index.js';

const event: BotEvent<'voiceStateUpdate'> = {
  name: 'voiceStateUpdate',
  async execute(client: ExtendedClient, oldState: VoiceState, newState: VoiceState) {
    try {
      // Handle Join to Create logic
      await client.j2cManager.handleVoiceStateUpdate(oldState, newState);
      
      // You can add other voice-related handlers here
      // For example: voice level tracking, voice activity logging, etc.
      
    } catch (error) {
      client.logger.error('❌ Error in voiceStateUpdate event:', error);
    }
  }
};

export default event;