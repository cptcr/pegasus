// src/handlers/CommandHandler.ts - Enhanced Command Handler with Metadata Support
import { ExtendedClient } from "../index.js";
import { readdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { Command } from "../types/index.js";
import { CommandMetadata } from "../types/CommandMetadata.js";

export class CommandHandler {
    private client: ExtendedClient;
    public commandMetadata: Map<string, CommandMetadata> = new Map();

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
                            const metadata = commandModule.metadata as CommandMetadata;
                            
                            if ('data' in command && 'execute' in command) {
                                // Ensure category is set
                                command.category = folder;
                                
                                // Store command
                                this.client.commands.set(command.data.name, command);
                                
                                // Store metadata if available
                                if (metadata) {
                                    this.commandMetadata.set(command.data.name, {
                                        ...metadata,
                                        category: folder // Ensure category matches folder
                                    });
                                } else {
                                    // Create basic metadata from command data
                                    this.commandMetadata.set(command.data.name, {
                                        name: command.data.name,
                                        description: command.data.description,
                                        category: folder,
                                        cooldown: command.cooldown || 3
                                    });
                                }
                                
                                this.client.logger.debug(`✅ Loaded command: /${command.data.name} (${folder})`);
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
            
            this.client.logger.info(`📋 Loaded a total of ${this.client.commands.size} commands across ${commandFolders.length} categories.`);
            this.logCommandStatistics();
        } catch (error) {
            this.client.logger.error(`❌ Failed to read commands directory:`, error);
        }
    }

    private logCommandStatistics(): void {
        const categoryStats = new Map<string, number>();
        
        for (const [commandName, metadata] of this.commandMetadata) {
            const category = metadata.category;
            categoryStats.set(category, (categoryStats.get(category) || 0) + 1);
        }

        this.client.logger.info('📊 Command Statistics:');
        for (const [category, count] of categoryStats) {
            this.client.logger.info(`   ${category}: ${count} commands`);
        }
    }

    public getCommandMetadata(commandName: string): CommandMetadata | undefined {
        return this.commandMetadata.get(commandName);
    }

    public getCommandsByCategory(category: string): Command[] {
        const commands: Command[] = [];
        
        for (const [commandName, command] of this.client.commands) {
            if (command.category === category) {
                commands.push(command);
            }
        }
        
        return commands;
    }

    public getAllCategories(): string[] {
        const categories = new Set<string>();
        
        for (const [commandName, metadata] of this.commandMetadata) {
            categories.add(metadata.category);
        }
        
        return Array.from(categories).sort();
    }

    public searchCommands(query: string): Command[] {
        const results: Command[] = [];
        const queryLower = query.toLowerCase();
        
        for (const [commandName, command] of this.client.commands) {
            const metadata = this.commandMetadata.get(commandName);
            
            // Search in command name
            if (commandName.toLowerCase().includes(queryLower)) {
                results.push(command);
                continue;
            }
            
            // Search in description
            if (command.data.description.toLowerCase().includes(queryLower)) {
                results.push(command);
                continue;
            }
            
            // Search in metadata aliases
            if (metadata?.aliases?.some(alias => alias.toLowerCase().includes(queryLower))) {
                results.push(command);
                continue;
            }
            
            // Search in category
            if (command.category.toLowerCase().includes(queryLower)) {
                results.push(command);
                continue;
            }
        }
        
        return results;
    }

    public getCommandCount(): number {
        return this.client.commands.size;
    }

    public getCategoryCount(): number {
        return this.getAllCategories().length;
    }
}