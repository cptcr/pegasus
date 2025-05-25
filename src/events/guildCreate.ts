import { Events, Guild } from 'discord.js';
import { ClientWithCommands, GuildSettings, Event } from '../types';

const event: Event<typeof Events.GuildCreate> = {
  name: Events.GuildCreate,
  async execute(client: ClientWithCommands, guild: Guild) {
    try {
      const defaultSettings: Omit<GuildSettings, 'id' | 'createdAt' | 'updatedAt'> = {
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
        welcomeMessage: `Willkommen {user} auf **${guild.name}**!`,
        leaveMessage: `Auf Wiedersehen {user}!`,
        quarantineRoleId: null,
      };

      await client.prisma.guild.upsert({
        where: { id: guild.id },
        update: { name: guild.name },
        create: {
          id: guild.id,
          name: guild.name,
          ...defaultSettings,
        },
      });

      const systemChannel = guild.systemChannel;
      if (systemChannel && systemChannel.permissionsFor(client.user!)?.has("SendMessages")) {
        await systemChannel.send(
          `Hallo! Ich bin Pegasus, dein neuer multifunktionaler Bot. Verwende \`${defaultSettings.prefix}hilfe\` oder \`/hilfe\` für eine Befehlsübersicht.`
        ).catch(console.error);
      }

    } catch (error) {
      console.error(`Fehler beim Erstellen/Aktualisieren des Datenbankeintrags für Gilde ${guild.name}:`, error);
    }
  }
};

export default event;