import { REST, Routes, Collection, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { ClientWithCommands, SlashCommand, PrefixCommand } from '../types';

export async function registerCommands(client: ClientWithCommands): Promise<void> {
  client.slashCommands = new Collection();
  client.commands = new Collection();
  const slashCommandsToRegister: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

  const slashCommandsPath = path.join(__dirname, 'slash');

  async function loadCommandsInDirectory(directory: string) {
    const files = fs.readdirSync(directory, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(directory, file.name);
      if (file.isDirectory()) {
        // Recursively load commands if you want to support deeper nesting
        // For now, we assume one level of subdirectories for categories or command groups
        // If a directory 'foo' contains 'foo.ts', it's a command group.
        // Files inside 'foo/' that are not 'foo.ts' would be subcommands.
        // This logic can get complex, for now, let's stick to simple file loading
        // and expect command files to define their own subcommands.
      } else if ((file.name.endsWith('.js') || file.name.endsWith('.ts')) && !file.name.startsWith('index.')) {
        try {
          const commandModule = await import(filePath);
          const command = (commandModule.default || commandModule) as SlashCommand;

          if (command.data && typeof command.execute === 'function') {
            if (command.enabled !== false) {
              client.slashCommands.set(command.data.name, command);
              // SlashCommandBuilder's toJSON() is what we need.
              slashCommandsToRegister.push(command.data.toJSON());
            }
          }
        } catch (error) {
          console.error(`Fehler beim Laden des Slash-Befehls ${file.name} aus ${filePath}:`, error);
        }
      }
    }
  }

  if (fs.existsSync(slashCommandsPath)) {
    await loadCommandsInDirectory(slashCommandsPath); // Load top-level slash commands

    // Example for loading from subdirectories (e.g. src/commands/slash/utility/ping.ts)
    const subdirectories = fs.readdirSync(slashCommandsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const subdir of subdirectories) {
      await loadCommandsInDirectory(path.join(slashCommandsPath, subdir));
    }
  }


  const prefixCommandsPath = path.join(__dirname, 'prefix');
  try {
    if (fs.existsSync(prefixCommandsPath)) {
      const prefixCommandFolders = fs.readdirSync(prefixCommandsPath).filter(folder =>
        fs.statSync(path.join(prefixCommandsPath, folder)).isDirectory()
      );

      for (const folder of prefixCommandFolders) {
        const categoryPath = path.join(prefixCommandsPath, folder);
        const commandFiles = fs.readdirSync(categoryPath).filter(file =>
          (file.endsWith('.js') || file.endsWith('.ts')) && !file.startsWith('index.')
        );

        for (const file of commandFiles) {
          const filePath = path.join(categoryPath, file);
          try {
            const commandModule = await import(filePath);
            const command = (commandModule.default || commandModule) as PrefixCommand;

            if (command.name && typeof command.execute === 'function') {
              if (command.enabled !== false) {
                command.category = command.category || folder;
                client.commands.set(command.name, command);
                if (command.aliases) {
                  command.aliases.forEach(alias => client.commands.set(alias, command));
                }
              }
            }
          } catch (error) {
            console.error(`Fehler beim Laden des Prefix-Befehls ${file} in Kategorie ${folder}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Fehler beim Lesen des Prefix-Befehlsverzeichnisses:`, error);
  }

  if (!process.env.DISCORD_BOT_TOKEN || !client.user?.id) {
    console.error('Bot-Token oder Client-ID nicht verfügbar. Slash-Befehle können nicht registriert werden.');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    if (slashCommandsToRegister.length > 0) {
        if (process.env.NODE_ENV === 'production' || process.env.DEPLOY_COMMANDS_GLOBALLY === 'true') {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: slashCommandsToRegister },
        );
        } else {
        if (client.config.devGuilds && client.config.devGuilds.length > 0) {
            for (const guildId of client.config.devGuilds) {
            try {
                await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: slashCommandsToRegister },
                );
            } catch (guildError) {
                console.error(`Fehler beim Registrieren von Befehlen für Gilde ${guildId}:`, guildError);
            }
            }
        }
        }
    }
  } catch (error) {
    console.error('Fehler beim Registrieren der Applikationsbefehle:', error);
  }
}