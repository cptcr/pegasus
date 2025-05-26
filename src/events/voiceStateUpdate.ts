// src/events/voiceStateUpdate.ts - Voice State Update Event Handler
import { Events, VoiceState } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { Join2CreateManager } from '../modules/voice/Join2CreateManager.js';

// Create a single instance of the manager to maintain state
let j2cManager: Join2CreateManager | null = null;

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState, client: ExtendedClient) {
    try {
      // Initialize Join2Create manager if not already done
      if (!j2cManager) {
        j2cManager = new Join2CreateManager(client, client.db, client.logger);
      }
      
      // Handle Join to Create logic
      await j2cManager.handleVoiceStateUpdate(oldState, newState);
      
      // You can add other voice-related handlers here
      // For example: voice level tracking, voice activity logging, etc.
      
    } catch (error) {
      client.logger.error('Error in voiceStateUpdate event:', error);
    }
  }
};