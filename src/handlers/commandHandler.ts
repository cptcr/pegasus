import { Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { ExtendedClient, Command } from '../types';
import { config } from '../utils/config';

export class CommandHandler {
  private client: ExtendedClient;
  private commands: Collection<string, Command>;

  constructor(client: ExtendedClient) {
    this.client = client;
    this.commands = new Collection();
    this.client.commands = this.commands;
  }

  public async loadCommands(): Promise<void> {
    const commandsPath = join(__dirname, '../commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
      const commandsDir = join(commandsPath, folder);
      const commandFiles = readdirSync(commandsDir).filter(file => file.endsWith('.js'));

      for (const file of commandFiles) {
        const filePath = join(commandsDir, file);
        const commandModule = await import(filePath);

        if (commandModule.data && commandModule.execute) {
          const command = {
            data: commandModule.data,
            execute: commandModule.execute
          };
          this.commands.set(command.data.name, command);
          console.log(`Loaded command: ${command.data.name}`);
        } else {
          console.log(`Warning: Command at ${filePath} is missing a required "data" or "execute" export.`);
        }
      }
    }
  }

  public async registerCommands(): Promise<void> {
    const commands = [];

    for (const command of this.commands.values()) {
      commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);

    try {
      console.log(`Started refreshing ${commands.length} application (/) commands.`);

      await rest.put(
        Routes.applicationCommands(config.CLIENT_ID),
        { body: commands }
      );

      console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
    } catch (error) {
      console.error('Error registering commands:', error);
    }
  }

  public getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  public getAllCommands(): Collection<string, Command> {
    return this.commands;
  }
}