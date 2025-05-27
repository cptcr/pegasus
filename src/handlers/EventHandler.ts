// src/handlers/EventHandler.ts - Fixed Event Handler
import { ExtendedClient } from '../index.js';
import { Logger } from '../utils/Logger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

export class EventHandler {
  private client: ExtendedClient;
  private logger: Logger;

  constructor(client: ExtendedClient) {
    this.client = client;
    this.logger = client.logger;
  }

  async loadEvents(): Promise<void> {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    const eventsPath = path.join(__dirname, '..', 'events');
    
    if (!fs.existsSync(eventsPath)) {
      this.logger.warn('⚠️ Events directory not found');
      return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => 
      (file.endsWith('.ts') || file.endsWith('.js')) && !file.startsWith('.')
    );

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
        const event = await import(fileUrl);
        const eventData = event.default || event;

        if (eventData.name && eventData.execute) {
          if (eventData.once) {
            this.client.once(eventData.name, (...args) => eventData.execute(this.client, ...args));
          } else {
            this.client.on(eventData.name, (...args) => eventData.execute(this.client, ...args));
          }
          this.logger.debug(`📅 Loaded event: ${eventData.name}`);
        }
      } catch (error) {
        this.logger.error(`❌ Failed to load event ${file}:`, error);
      }
    }
  }
}