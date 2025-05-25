import { ClientWithCommands, GuildSettings } from '../types';
import { Prisma } from '@prisma/client';

const settingsCache = new Map<string, { settings: GuildSettings, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export async function getGuildSettings(guildId: string, client: ClientWithCommands): Promise<GuildSettings> {
  const cachedEntry = settingsCache.get(guildId);
  if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION)) {
    return cachedEntry.settings;
  }

  try {
    let settings = await client.prisma.guild.findUnique({
      where: { id: guildId },
    });

    if (!settings) {
      const defaultSettingsData: Prisma.GuildCreateInput = {
        id: guildId,
        name: client.guilds.cache.get(guildId)?.name || 'Unbekannte Gilde',
        prefix: client.config.defaultPrefix,
        enableLeveling: client.config.enabledFeatures.leveling,
        enableModeration: client.config.enabledFeatures.moderation,
        enableGeizhals: client.config.enabledFeatures.geizhals,
        enablePolls: client.config.enabledFeatures.polls,
        enableGiveaways: client.config.enabledFeatures.giveaways,
        enableAutomod: client.config.enabledFeatures.automod ?? client.config.enabledFeatures.moderation,
        enableTickets: client.config.enabledFeatures.tickets,
        enableMusic: client.config.enabledFeatures.music,
        enableJoinToCreate: client.config.enabledFeatures.joinToCreate,
        modLogChannelId: null,
        levelUpChannelId: null,
        welcomeChannelId: null,
        geizhalsChannelId: null,
        joinToCreateChannelId: null,
        joinToCreateCategoryId: null,
        welcomeMessage: `Willkommen {user} auf **${client.guilds.cache.get(guildId)?.name || 'dem Server'}**!`,
        leaveMessage: `Auf Wiedersehen {user}!`,
        quarantineRoleId: null,
      };
      settings = await client.prisma.guild.create({
        data: defaultSettingsData,
      });
    }

    const guildSettings = settings as GuildSettings;
    settingsCache.set(guildId, { settings: guildSettings, timestamp: Date.now() });
    return guildSettings;

  } catch (error) {
    console.error(`Fehler beim Abrufen/Erstellen der Einstellungen für Gilde ${guildId}:`, error);
    const fallbackSettings: GuildSettings = {
      id: guildId,
      name: client.guilds.cache.get(guildId)?.name || 'Unbekannte Gilde (Fallback)',
      prefix: client.config.defaultPrefix,
      enableLeveling: client.config.enabledFeatures.leveling,
      enableModeration: client.config.enabledFeatures.moderation,
      enableGeizhals: client.config.enabledFeatures.geizhals,
      enablePolls: client.config.enabledFeatures.polls,
      enableGiveaways: client.config.enabledFeatures.giveaways,
      enableAutomod: client.config.enabledFeatures.automod ?? client.config.enabledFeatures.moderation,
      enableTickets: client.config.enabledFeatures.tickets,
      enableMusic: client.config.enabledFeatures.music,
      enableJoinToCreate: client.config.enabledFeatures.joinToCreate,
      modLogChannelId: null,
      levelUpChannelId: null,
      welcomeChannelId: null,
      geizhalsChannelId: null,
      joinToCreateChannelId: null,
      joinToCreateCategoryId: null,
      welcomeMessage: `Willkommen {user}!`,
      leaveMessage: `{user} hat uns verlassen.`,
      quarantineRoleId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return fallbackSettings;
  }
}

export async function updateGuildSettings(
  guildId: string,
  client: ClientWithCommands,
  data: Partial<Omit<GuildSettings, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<GuildSettings> {
  try {
    const updatedSettings = await client.prisma.guild.update({
      where: { id: guildId },
      data: { ...data, updatedAt: new Date() },
    });

    const guildSettings = updatedSettings as GuildSettings;
    settingsCache.set(guildId, { settings: guildSettings, timestamp: Date.now() });
    return guildSettings;
  } catch (error) {
    console.error(`Fehler beim Aktualisieren der Einstellungen für Gilde ${guildId}:`, error);
    throw error;
  }
}

export function invalidateGuildSettingsCache(guildId: string): void {
  settingsCache.delete(guildId);
}