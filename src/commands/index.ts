// src/commands/index.ts - Befehlsregistrierung
import { REST, Routes, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { ClientWithCommands, SlashCommand, PrefixCommand } from '../types'; // ClientWithCommands verwenden

export async function registerCommands(client: ClientWithCommands): Promise<void> {
  const slashCommandsToRegister: any[] = []; // Typ any für toJSON()
  client.slashCommands = new Collection();
  client.commands = new Collection();

  // Slash-Befehle laden
  const slashCommandsPath = path.join(__dirname, 'slash');
  try {
    if (fs.existsSync(slashCommandsPath)) {
      const slashCommandFiles = fs.readdirSync(slashCommandsPath).filter(file =>
        (file.endsWith('.js') || file.endsWith('.ts')) && !file.startsWith('index.')
      );

      console.log(`🔎 Lade ${slashCommandFiles.length} Slash-Befehl(e)...`);
      for (const file of slashCommandFiles) {
        const filePath = path.join(slashCommandsPath, file);
        try {
          const commandModule = require(filePath);
          const command = (commandModule.default || commandModule) as SlashCommand;

          if (command.data && typeof command.execute === 'function') {
            if (command.enabled !== false) {
              client.slashCommands.set(command.data.name, command);
              slashCommandsToRegister.push(command.data.toJSON());
              console.log(`  👍 Slash-Befehl geladen: ${command.data.name}`);
            } else {
              console.log(`  🚫 Slash-Befehl übersprungen (deaktiviert): ${command.data.name}`);
            }
          } else {
            console.warn(`⚠️ Die Slash-Befehlsdatei unter ${filePath} exportiert keinen gültigen Befehl.`);
          }
        } catch (error) {
          console.error(`❌ Fehler beim Laden des Slash-Befehls ${file}:`, error);
        }
      }
    } else {
      console.warn(`⚠️ Verzeichnis für Slash-Befehle nicht gefunden: ${slashCommandsPath}`);
    }
  } catch (error) {
    console.error(`❌ Fehler beim Lesen des Slash-Befehlsverzeichnisses:`, error);
  }


  // Prefix-Befehle laden
  const prefixCommandsPath = path.join(__dirname, 'prefix');
  try {
    if (fs.existsSync(prefixCommandsPath)) {
      const prefixCommandFolders = fs.readdirSync(prefixCommandsPath).filter(folder =>
        fs.statSync(path.join(prefixCommandsPath, folder)).isDirectory()
      );

      console.log(`🔎 Lade Prefix-Befehle aus ${prefixCommandFolders.length} Kategorie(n)...`);
      for (const folder of prefixCommandFolders) {
        const categoryPath = path.join(prefixCommandsPath, folder);
        const commandFiles = fs.readdirSync(categoryPath).filter(file =>
          (file.endsWith('.js') || file.endsWith('.ts')) && !file.startsWith('index.')
        );

        for (const file of commandFiles) {
          const filePath = path.join(categoryPath, file);
          try {
            const commandModule = require(filePath);
            const command = (commandModule.default || commandModule) as PrefixCommand;

            if (command.name && typeof command.execute === 'function') {
              if (command.enabled !== false) {
                command.category = command.category || folder; // Kategorie setzen, falls nicht vorhanden
                client.commands.set(command.name, command);
                console.log(`  👍 Prefix-Befehl geladen: ${command.name} (Kategorie: ${command.category})`);
              } else {
                console.log(`  🚫 Prefix-Befehl übersprungen (deaktiviert): ${command.name}`);
              }
            } else {
              console.warn(`⚠️ Die Prefix-Befehlsdatei unter ${filePath} exportiert keinen gültigen Befehl.`);
            }
          } catch (error) {
            console.error(`❌ Fehler beim Laden des Prefix-Befehls ${file} in Kategorie ${folder}:`, error);
          }
        }
      }
    } else {
      console.warn(`⚠️ Verzeichnis für Prefix-Befehle nicht gefunden: ${prefixCommandsPath}`);
    }
  } catch (error) {
    console.error(`❌ Fehler beim Lesen des Prefix-Befehlsverzeichnisses:`, error);
  }


  // Slash-Befehle bei Discord API registrieren
  if (!process.env.DISCORD_BOT_TOKEN || !client.user?.id) {
    console.error('❌ Bot-Token oder Client-ID nicht verfügbar. Slash-Befehle können nicht registriert werden.');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log(`🔄 Aktualisiere ${slashCommandsToRegister.length} Applikationsbefehle (/).`);

    if (process.env.NODE_ENV === 'production' || process.env.DEPLOY_COMMANDS_GLOBALLY === 'true') {
      // Globale Registrierung in Produktion oder wenn explizit gewünscht
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: slashCommandsToRegister },
      );
      console.log(`🌐 ${slashCommandsToRegister.length} globale Applikationsbefehle erfolgreich registriert.`);
    } else {
      // Gildenspezifische Registrierung in Entwicklung
      if (client.config.devGuilds && client.config.devGuilds.length > 0) {
        for (const guildId of client.config.devGuilds) {
          try {
            await rest.put(
              Routes.applicationGuildCommands(client.user.id, guildId),
              { body: slashCommandsToRegister },
            );
            console.log(`🔧 ${slashCommandsToRegister.length} gilden-spezifische Applikationsbefehle in Gilde ${guildId} erfolgreich registriert.`);
          } catch (guildError) {
            console.error(`❌ Fehler beim Registrieren von Befehlen für Gilde ${guildId}:`, guildError);
          }
        }
      } else {
        console.warn('⚠️ Keine devGuilds in der Konfiguration gefunden. Slash-Befehle werden nur lokal geladen, aber nicht bei Discord registriert.');
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Registrieren der Applikationsbefehle:', error);
  }

  console.log(`📝 ${client.commands.size} Prefix-Befehle geladen.`);
  console.log(`⚡ ${client.slashCommands.size} Slash-Befehle geladen und für die Registrierung vorbereitet.`);
}
