import { readdirSync } from 'fs';
import { join } from 'path';
import { ExtendedClient } from '../types';

export class EventHandler {
  private client: ExtendedClient;

  constructor(client: ExtendedClient) {
    this.client = client;
  }

  public async loadEvents(): Promise<void> {
    const eventsPath = join(__dirname, '../events');
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    console.log(`Loading ${eventFiles.length} event files...`);

    for (const file of eventFiles) {
      const filePath = join(eventsPath, file);
      const eventModule = await import(filePath);
      const event = eventModule.event;

      if (event && event.name) {
        if (event.once) {
          this.client.once(event.name, (...args) => event.execute(...args));
        } else {
          this.client.on(event.name, (...args) => event.execute(...args));
        }

        console.log(`Loaded event: ${event.name}`);
      } else {
        console.log(`Warning: Event at ${filePath} is missing required "name" or "execute" property.`);
      }
    }
  }
}