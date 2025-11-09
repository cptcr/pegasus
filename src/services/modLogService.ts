import type { MessageCreateOptions } from 'discord.js';
import { Guild, ChannelType } from 'discord.js';
import { modLogRepository } from '../repositories/modLogRepository';
import type { ModLogCategory, ModLogSetting } from '../types';
import { logger } from '../utils/logger';

interface CachedModLogSettings {
  fetchedAt: number;
  settings: Map<ModLogCategory, ModLogSetting>;
}

const CACHE_TTL_MS = 60 * 1000;

export class ModLogService {
  private cache = new Map<string, CachedModLogSettings>();

  async getSettings(guildId: string): Promise<Map<ModLogCategory, ModLogSetting>> {
    const cached = this.cache.get(guildId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.settings;
    }

    const records = await modLogRepository.getByGuild(guildId);
    const mapped = new Map<ModLogCategory, ModLogSetting>();
    for (const record of records) {
      mapped.set(record.category, record);
    }

    this.cache.set(guildId, {
      fetchedAt: Date.now(),
      settings: mapped,
    });

    return mapped;
  }

  async getSetting(guildId: string, category: ModLogCategory): Promise<ModLogSetting | null> {
    const settings = await this.getSettings(guildId);
    return settings.get(category) ?? null;
  }

  async setChannel(
    guildId: string,
    category: ModLogCategory,
    channelId: string,
    enabled = true
  ): Promise<ModLogSetting> {
    const setting = await modLogRepository.upsert(guildId, category, channelId, enabled);
    this.invalidateCache(guildId);
    return setting;
  }

  async setEnabled(
    guildId: string,
    category: ModLogCategory,
    enabled: boolean
  ): Promise<ModLogSetting | null> {
    const setting = await modLogRepository.setEnabled(guildId, category, enabled);
    this.invalidateCache(guildId);
    return setting;
  }

  async remove(guildId: string, category: ModLogCategory): Promise<boolean> {
    const removed = await modLogRepository.delete(guildId, category);
    this.invalidateCache(guildId);
    return removed;
  }

  async sendLog(
    guild: Guild,
    category: ModLogCategory,
    payload: MessageCreateOptions
  ): Promise<void> {
    const setting = await this.getSetting(guild.id, category);

    if (!setting || !setting.enabled) {
      return;
    }

    const channel = await this.resolveChannel(guild, setting.channelId);

    if (!channel) {
      logger.warn(
        `[ModLog] Channel ${setting.channelId} for ${category} not found in guild ${guild.id}`
      );
      return;
    }

    if (!('isTextBased' in channel) || !channel.isTextBased()) {
      logger.warn(
        `[ModLog] Configured channel ${channel.id} for ${category} is not text-based (type ${ChannelType[channel.type]})`
      );
      return;
    }

    try {
      await channel.send(payload);
    } catch (error) {
      logger.error(
        `[ModLog] Failed to send ${category} log to channel ${channel.id} in guild ${guild.id}`,
        error
      );
    }
  }

  async sendDirect(
    guild: Guild,
    channelId: string,
    payload: MessageCreateOptions
  ): Promise<boolean> {
    const channel = await this.resolveChannel(guild, channelId);

    if (!channel) {
      logger.warn(`[ModLog] Direct channel ${channelId} not found in guild ${guild.id}`);
      return false;
    }

    if (!('isTextBased' in channel) || !channel.isTextBased()) {
      logger.warn(
        `[ModLog] Direct channel ${channel.id} is not text-based (type ${ChannelType[channel.type]})`
      );
      return false;
    }

    try {
      await channel.send(payload);
      return true;
    } catch (error) {
      logger.error(
        `[ModLog] Failed to send direct log to channel ${channel.id} in guild ${guild.id}`,
        error
      );
      return false;
    }
  }

  invalidateCache(guildId: string): void {
    this.cache.delete(guildId);
  }

  private async resolveChannel(guild: Guild, channelId: string) {
    const cached = guild.channels.cache.get(channelId);
    if (cached) {
      return cached;
    }

    try {
      return await guild.channels.fetch(channelId);
    } catch (error) {
      logger.debug(`[ModLog] Failed to fetch channel ${channelId} in guild ${guild.id}`, error);
      return null;
    }
  }
}

export const modLogService = new ModLogService();
