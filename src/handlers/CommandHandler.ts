// src/handlers/CommandHandler.ts
import { ExtendedClient } from "../index.js";
import { readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { Command } from "../types/index.js";

export class CommandHandler {
    private client: ExtendedClient;

    constructor(client: ExtendedClient) {
        this.client = client;
    }

    public async loadCommands(): Promise<void> {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = fileURLToPath(new URL('.', import.meta.url));
        const commandsPath = join(__dirname, '..', 'commands');
        const commandFolders = readdirSync(commandsPath);

        for (const folder of commandFolders) {
            const folderPath = join(commandsPath, folder);
            const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

            for (const file of commandFiles) {
                const filePath = join(folderPath, file);
                try {
                    const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
                    const { default: command } = await import(fileUrl) as { default: Command };
                    if ('data' in command && 'execute' in command) {
                        command.category = folder; // Assign category based on folder
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