// src/handlers/CommandHandler.ts - Fixed Command Handler
import { ExtendedClient } from "../index.js";
import { readdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { Command } from "../types/index.js";

export class CommandHandler {
    private client: ExtendedClient;

    constructor(client: ExtendedClient) {
        this.client = client;
    }

    public async loadCommands(): Promise<void> {
        const commandsPath = join(process.cwd(), 'src', 'commands');
        
        try {
            const commandFolders = readdirSync(commandsPath);

            for (const folder of commandFolders) {
                const folderPath = join(commandsPath, folder);
                
                try {
                    const commandFiles = readdirSync(folderPath).filter(file => 
                        file.endsWith('.js') || file.endsWith('.ts')
                    );

                    for (const file of commandFiles) {
                        const filePath = join(folderPath, file);
                        
                        try {
                            // Convert file path to file URL for ES modules
                            const fileUrl = pathToFileURL(filePath).href;
                            const commandModule = await import(fileUrl);
                            const command = commandModule.default as Command;
                            
                            if ('data' in command && 'execute' in command) {
                                command.category = folder;
                                this.client.commands.set(command.data.name, command);
                                this.client.logger.debug(`✅ Loaded command: /${command.data.name}`);
                            } else {
                                this.client.logger.warn(`⚠️ The command at ${filePath} is missing a required "data" or "execute" property.`);
                            }
                        } catch (error) {
                            this.client.logger.error(`❌ Failed to load command at ${filePath}:`, error);
                        }
                    }
                } catch (error) {
                    this.client.logger.error(`❌ Failed to read command folder ${folder}:`, error);
                }
            }
            
            this.client.logger.info(`📋 Loaded a total of ${this.client.commands.size} commands.`);
        } catch (error) {
            this.client.logger.error(`❌ Failed to read commands directory:`, error);
        }
    }
}