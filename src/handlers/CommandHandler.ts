// src/handlers/CommandHandler.ts
import { ExtendedClient } from "@/index";
import { readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { Command } from "@/types";

export class CommandHandler {
    private client: ExtendedClient;

    constructor(client: ExtendedClient) {
        this.client = client;
    }

    public async loadCommands(): Promise<void> {
        const commandsPath = join(process.cwd(), 'src', 'commands');
        const commandFolders = readdirSync(commandsPath);

        for (const folder of commandFolders) {
            const folderPath = join(commandsPath, folder);
            const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

            for (const file of commandFiles) {
                const filePath = join(folderPath, file);
                try {
                    const { default: command } = await import(filePath) as { default: Command };
                    if ('data' in command && 'execute' in command) {
                        command.category = folder;
                        this.client.commands.set(command.data.name, command);
                        this.client.logger.debug(`Loaded command: /${command.data.name}`);
                    } else {
                        this.client.logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
                    }
                } catch (error) {
                    this.client.logger.error(`Failed to load command at ${filePath}:`, error);
                }
            }
        }
        this.client.logger.info(`Loaded a total of ${this.client.commands.size} commands.`);
    }
}