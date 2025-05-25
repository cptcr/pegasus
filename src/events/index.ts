// src/events/index.ts - Event-Registrierung
import fs from 'fs';
import path from 'path';
import { ClientWithCommands, Event } from '../types'; // Sicherstellen, dass ClientWithCommands verwendet wird

export function registerEvents(client: ClientWithCommands): void {
  const eventsPath = path.join(__dirname);
  const eventFiles = fs.readdirSync(eventsPath).filter(file =>
    (file.endsWith('.js') || file.endsWith('.ts')) &&
    !file.startsWith('index.') // Ignoriert index.js und index.ts
  );

  let count = 0;
  for (const file of eventFiles) {
    try {
      const filePath = path.join(eventsPath, file);
      const eventModule = require(filePath);
      const event = (eventModule.default || eventModule) as Event<any>; // Berücksichtigt default export

      if (!event.name || typeof event.execute !== 'function') {
        console.warn(`⚠️ Die Event-Datei unter ${filePath} exportiert kein gültiges Event-Objekt (fehlender Name oder Execute-Funktion).`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(client, ...args));
      } else {
        client.on(event.name, (...args) => event.execute(client, ...args));
      }
      count++;
    } catch (error) {
      console.error(`❌ Fehler beim Laden des Events aus ${file}:`, error);
    }
  }

  console.log(`📣 ${count} Event-Handler erfolgreich registriert.`);
}
