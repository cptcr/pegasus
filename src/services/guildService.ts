import { Guild } from 'discord.js';
import { guildRepository } from '../repositories/guildRepository';
import { logger } from '../utils/logger';
import type { Guild as GuildModel, GuildSettings } from '../types';

export class GuildService {
  async ensureGuild(guild: Guild): Promise<GuildModel> {
    try {
      let guildData = await guildRepository.findById(guild.id);

      if (!guildData) {
        logger.info(`Creating database entry for guild ${guild.name} (${guild.id})`);
        guildData = await guildRepository.create(guild.id);

        // Initialize default settings
        await guildRepository.updateSettings(guild.id, {
          welcomeEnabled: false,
          goodbyeEnabled: false,
          logsEnabled: false,
          xpEnabled: true,
          xpRate: 1,
        });
      }

      return guildData;
    } catch (error) {
      logger.error(`Failed to ensure guild ${guild.id}:`, error);
      throw error;
    }
  }

  async getGuildSettings(guildId: string): Promise<GuildSettings> {
    try {
      let settings = await guildRepository.getSettings(guildId);

      if (!settings) {
        // Create default settings if they don't exist
        settings = await guildRepository.updateSettings(guildId, {
          welcomeEnabled: false,
          goodbyeEnabled: false,
          logsEnabled: false,
          xpEnabled: true,
          xpRate: 1,
        });
      }

      return settings;
    } catch (error) {
      logger.error(`Failed to get guild settings for ${guildId}:`, error);
      throw error;
    }
  }

  async updateGuildSettings(
    guildId: string,
    settings: Partial<Omit<GuildSettings, 'guildId' | 'createdAt' | 'updatedAt'>>
  ): Promise<GuildSettings> {
    try {
      return await guildRepository.updateSettings(guildId, settings);
    } catch (error) {
      logger.error(`Failed to update guild settings for ${guildId}:`, error);
      throw error;
    }
  }

  async deleteGuild(guildId: string): Promise<boolean> {
    try {
      return await guildRepository.delete(guildId);
    } catch (error) {
      logger.error(`Failed to delete guild ${guildId}:`, error);
      throw error;
    }
  }

  async getGuildLanguage(guildId: string): Promise<string> {
    try {
      const guild = await guildRepository.findById(guildId);
      return guild?.language || 'en';
    } catch (error) {
      logger.error(`Failed to get guild language for ${guildId}:`, error);
      return 'en';
    }
  }
}

// Export singleton instance
export const guildService = new GuildService();
