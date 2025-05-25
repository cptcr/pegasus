// src/events/index.ts - Event registration
import fs from 'fs';
import path from 'path';
import { Client, Event } from '../types';

export function registerEvents(client: Client): void {
  const eventsPath = path.join(__dirname);
  const eventFiles = fs.readdirSync(eventsPath).filter(file => 
    (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('index.js') && !file.endsWith('index.ts')
  );

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath).default as Event<any>;
    
    if (!event.name || !event.execute) {
      console.warn(`⚠️ The event at ${filePath} is missing required "name" or "execute" property.`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  console.log(`📣 Registered ${eventFiles.length} event handlers.`);
}