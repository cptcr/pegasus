// src/events/guildCreate.ts - Wenn der Bot einer neuen Gilde beitritt
import { Events, Guild } from 'discord.js';
import { ClientWithCommands, Event, GuildSettings } from '../types'; // ClientWithCommands verwenden

const event: Event<typeof Events.GuildCreate> = {
  name: Events.GuildCreate,
  async execute(client: ClientWithCommands, guild: Guild) { // Client als erstes Argument
    console.log(`🎉 Bot ist einer neuen Gilde beigetreten: ${guild.name} (ID: ${guild.id})`);

    // Standard-Gildeneinstellungen in der Datenbank erstellen oder aktualisieren
    try {
      const defaultSettings: Omit<GuildSettings, 'id' | 'createdAt' | 'updatedAt'> = {
        prefix: client.config.defaultPrefix,
        enableLeveling: client.config.enabledFeatures.leveling,
        enableModeration: client.config.enabledFeatures.moderation,
        enableGeizhals: client.config.enabledFeatures.geizhals,
        enablePolls: client.config.enabledFeatures.polls,
        enableGiveaways: client.config.enabledFeatures.giveaways,
        enableAutomod: client.config.enabledFeatures.moderation, // Automod oft Teil der Moderation
        enableTickets: client.config.enabledFeatures.tickets,
        enableMusic: client.config.enabledFeatures.music,
        enableJoinToCreate: client.config.enabledFeatures.joinToCreate,
        // Weitere Standardeinstellungen hier initialisieren
        modLogChannelId: null,
        levelUpChannelId: null,
        welcomeChannelId: null,
        geizhalsChannelId: null,
        joinToCreateChannelId: null,
        joinToCreateCategoryId: null,
        welcomeMessage: `Willkommen {user} auf **${guild.name}**!`,
        leaveMessage: `Auf Wiedersehen {user}!`,
        quarantineRoleId: null,
      };

      await client.prisma.guild.upsert({
        where: { id: guild.id },
        update: { name: guild.name }, // Name aktualisieren, falls er sich geändert hat
        create: {
          id: guild.id,
          name: guild.name,
          ...defaultSettings,
        },
      });

      console.log(`✅ Datenbankeintrag für Gilde erstellt/aktualisiert: ${guild.name}`);

      // Optional: Eine Willkommensnachricht in den Systemkanal der Gilde senden
      const systemChannel = guild.systemChannel;
      if (systemChannel && systemChannel.permissionsFor(client.user!)?.has("SendMessages")) {
        await systemChannel.send(
          `Hallo! Ich bin Pegasus, dein neuer multifunktionaler Bot. Verwende \`${defaultSettings.prefix}hilfe\` oder \`/hilfe\` für eine Befehlsübersicht.`
        ).catch(e => console.error("Konnte keine Willkommensnachricht senden:", e));
      }

    } catch (error) {
      console.error(`❌ Fehler beim Erstellen/Aktualisieren des Datenbankeintrags für Gilde ${guild.name}:`, error);
    }
  }
};

export default event;
