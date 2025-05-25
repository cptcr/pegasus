import { Events, ActivityType } from 'discord.js';
import { ClientWithCommands, Event, BotActivity } from '../types';
import { registerCommands } from '../commands';

const activities: BotActivity[] = [
  { name: '/hilfe | !hilfe', type: ActivityType.Watching },
  { name: 'dem Server zu', type: ActivityType.Listening },
  { name: 'mit Kommandos', type: ActivityType.Playing },
];
let activityIndex = 0;

const event: Event<typeof Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  async execute(client: ClientWithCommands) {
    if (!client.user) {
      return;
    }

    const setActivity = () => {
      if (!client.user) return;
      const currentActivity = activities[activityIndex];
      client.user.setPresence({
        activities: [{
          name: currentActivity.name,
          type: currentActivity.type,
          url: currentActivity.url,
        }],
        status: currentActivity.status || 'online',
      });
      activityIndex = (activityIndex + 1) % activities.length;
    };

    setActivity();
    setInterval(setActivity, 60000);

    try {
      await registerCommands(client);
    } catch (error) {
      console.error('Fehler beim Registrieren der Slash-Befehle:', error);
    }

    try {
      await client.prisma.$connect();
    } catch (error) {
      console.error('Fehler bei der Datenbankverbindung:', error);
    }
  }
};

export default event;