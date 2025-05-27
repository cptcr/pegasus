// src/handlers/EventHandler.ts - Fixed Event Handler
import { ExtendedClient } from '../index.js';
import { Logger } from '../utils/Logger.js';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

export class EventHandler {
  private client: ExtendedClient;
  private logger: typeof Logger;

  constructor(client: ExtendedClient) {
    this.client = client;
    this.logger = client.logger;
  }

  async loadEvents(): Promise<void> {
    const eventsPath = path.join(process.cwd(), 'src', 'events');
    
    if (!fs.existsSync(eventsPath)) {
      this.logger.warn('⚠️ Events directory not found');
      return;
    }

    try {
      const eventFiles = fs.readdirSync(eventsPath).filter(file => 
        (file.endsWith('.ts') || file.endsWith('.js')) && !file.startsWith('.')
      );

      for (const file of eventFiles) {
        try {
          const filePath = path.join(eventsPath, file);
          // Convert to file URL for ES modules
          const fileUrl = pathToFileURL(filePath).href;
          
          const eventModule = await import(fileUrl);
          const eventData = eventModule.default;

          if (eventData && eventData.name && eventData.execute) {
            if (eventData.once) {
              this.client.once(eventData.name, (...args) => eventData.execute(this.client, ...args));
            } else {
              this.client.on(eventData.name, (...args) => eventData.execute(this.client, ...args));
            }
            this.logger.debug(`📅 Loaded event: ${eventData.name}`);
          } else {
            this.logger.warn(`⚠️ Event file ${file} is missing required properties`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to load event ${file}:`, error);
        }
      }
      
      this.logger.info(`📅 Loaded ${eventFiles.length} events.`);
    } catch (error) {
      this.logger.error(`❌ Failed to load events:`, error);
    }
  }
}