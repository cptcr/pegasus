// src/utils/guildSettings.ts
import { ClientWithCommands, GuildSettings } from '../types';
import { Prisma } from '@prisma/client';

// Cache für Gildeneinstellungen, um Datenbankabfragen zu reduzieren
const settingsCache = new Map<string, { settings: GuildSettings, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 Minuten

/**
 * Ruft die Einstellungen für eine bestimmte Gilde ab.
 * Versucht zuerst, aus dem Cache zu laden, dann aus der Datenbank.
 * Erstellt Standardeinstellungen, falls keine vorhanden sind.
 * @param guildId Die ID der Gilde
 * @param client Der erweiterte Discord-Client
 * @returns Die Gildeneinstellungen
 */
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
      console.log(`Keine Einstellungen für Gilde ${guildId} gefunden. Erstelle Standardeinstellungen.`);
      const defaultSettingsData: Prisma.GuildCreateInput = {
        id: guildId,
        name: client.guilds.cache.get(guildId)?.name || 'Unbekannte Gilde',
        prefix: client.config.defaultPrefix,
        enableLeveling: client.config.enabledFeatures.leveling,
        enableModeration: client.config.enabledFeatures.moderation,
        enableGeizhals: client.config.enabledFeatures.geizhals,
        enablePolls: client.config.enabledFeatures.polls,
        enableGiveaways: client.config.enabledFeatures.giveaways,
        enableAutomod: client.config.enabledFeatures.moderation,
        enableTickets: client.config.enabledFeatures.tickets,
        enableMusic: client.config.enabledFeatures.music,
        enableJoinToCreate: client.config.enabledFeatures.joinToCreate,
        // Weitere Felder hier mit Standardwerten initialisieren
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

    // Prisma.Guild in GuildSettings umwandeln (falls nötig, hier sind sie kompatibel)
    const guildSettings = settings as GuildSettings;
    settingsCache.set(guildId, { settings: guildSettings, timestamp: Date.now() });
    return guildSettings;

  } catch (error) {
    console.error(`Fehler beim Abrufen/Erstellen der Einstellungen für Gilde ${guildId}:`, error);
    // Fallback auf In-Memory-Standardeinstellungen, um den Bot funktionsfähig zu halten
    const fallbackSettings: GuildSettings = {
      id: guildId,
      name: client.guilds.cache.get(guildId)?.name || 'Unbekannte Gilde (Fallback)',
      prefix: client.config.defaultPrefix,
      enableLeveling: client.config.enabledFeatures.leveling,
      enableModeration: client.config.enabledFeatures.moderation,
      enableGeizhals: client.config.enabledFeatures.geizhals,
      enablePolls: client.config.enabledFeatures.polls,
      enableGiveaways: client.config.enabledFeatures.giveaways,
      enableAutomod: client.config.enabledFeatures.moderation,
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

/**
 * Aktualisiert spezifische Einstellungen für eine Gilde.
 * @param guildId Die ID der Gilde
 * @param client Der erweiterte Discord-Client
 * @param data Die zu aktualisierenden Daten
 * @returns Die aktualisierten Gildeneinstellungen
 */
export async function updateGuildSettings(
  guildId: string,
  client: ClientWithCommands,
  data: Partial<Omit<GuildSettings, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<GuildSettings> {
  try {
    const updatedSettings = await client.prisma.guild.update({
      where: { id: guildId },
      data: { ...data, updatedAt: new Date() }, // updatedAt immer aktualisieren
    });

    const guildSettings = updatedSettings as GuildSettings;
    settingsCache.set(guildId, { settings: guildSettings, timestamp: Date.now() });
    return guildSettings;
  } catch (error) {
    console.error(`Fehler beim Aktualisieren der Einstellungen für Gilde ${guildId}:`, error);
    throw error; // Fehler weiterleiten, damit er im aufrufenden Code behandelt werden kann
  }
}

/**
 * Invalidiert den Cache für eine bestimmte Gilde.
 * @param guildId Die ID der Gilde
 */
export function invalidateGuildSettingsCache(guildId: string): void {
  settingsCache.delete(guildId);
  console.log(`Cache für Gildeneinstellungen (${guildId}) invalidiert.`);
}
