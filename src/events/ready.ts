// src/events/ready.ts - Bot ready Event
import { Events, ActivityType } from 'discord.js';
import { ClientWithCommands, Event, BotActivity } from '../types'; // ClientWithCommands verwenden
import { registerCommands } from '../commands'; // Importiere registerCommands

const activities: BotActivity[] = [
  { name: '/hilfe | !hilfe', type: ActivityType.Watching },
  { name: 'dem Server zu', type: ActivityType.Listening },
  { name: 'mit Kommandos', type: ActivityType.Playing },
];
let activityIndex = 0;

const event: Event<typeof Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  async execute(client: ClientWithCommands) { // ClientWithCommands verwenden
    if (!client.user) {
      console.error('Fehler: Client-Benutzer ist nicht initialisiert beim Ready-Event.');
      return;
    }
    console.log(`✅ Bot ist bereit! Angemeldet als ${client.user.tag}`);

    // Bot-Aktivität setzen und periodisch ändern
    const setActivity = () => {
      if (!client.user) return;
      const currentActivity = activities[activityIndex];
      client.user.setPresence({
        activities: [{
          name: currentActivity.name,
          type: currentActivity.type,
          url: currentActivity.url, // Nur für Streaming relevant
        }],
        status: currentActivity.status || 'online',
      });
      activityIndex = (activityIndex + 1) % activities.length;
    };

    setActivity(); // Sofort setzen
    setInterval(setActivity, 60000); // Alle 60 Sekunden ändern

    // Slash-Befehle registrieren, nachdem der Client bereit ist
    try {
      await registerCommands(client);
    } catch (error) {
      console.error('Fehler beim Registrieren der Slash-Befehle:', error);
    }

    // Log-Statistiken
    console.log(`🌐 Verbunden mit ${client.guilds.cache.size} Gilden`);
    console.log(`👥 Dient ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} Benutzern`);

    // Datenbankverbindung initialisieren (optional, falls Prisma global initialisiert wird)
    try {
      await client.prisma.$connect();
      console.log('📊 Datenbankverbindung erfolgreich hergestellt.');
    } catch (error) {
      console.error('❌ Fehler bei der Datenbankverbindung:', error);
    }

    // Zusätzliche Initialisierungsaufgaben hier...
    console.log("✨ Pegasus Bot ist voll einsatzbereit!");
  }
};

export default event;
