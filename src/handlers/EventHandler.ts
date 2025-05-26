// src/handlers/EventHandler.ts - Event Handler
import { ExtendedClient } from '../index.js';
import { Logger } from '../utils/Logger.js';
import path from 'path';
import fs from 'fs';

export class EventHandler {
  private client: ExtendedClient;
  private logger: Logger;

  constructor(client: ExtendedClient, logger: Logger) {
    this.client = client;
    this.logger = logger;
  }

  async loadEvents(): Promise<void> {
    const eventsPath = path.join(process.cwd(), 'src', 'events');
    
    if (!fs.existsSync(eventsPath)) {
      this.logger.warn('⚠️ Events directory not found');
      return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => 
      (file.endsWith('.ts') || file.endsWith('.js')) && !file.startsWith('.')
    );

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
        const event = await import(fileUrl);
        const eventData = event.default || event;

        if (eventData.name && eventData.execute) {
          if (eventData.once) {
            this.client.once(eventData.name, (...args) => eventData.execute(...args, this.client));
          } else {
            this.client.on(eventData.name, (...args) => eventData.execute(...args, this.client));
          }
          this.logger.debug(`📅 Loaded event: ${eventData.name}`);
        }
      } catch (error) {
        this.logger.error(`❌ Failed to load event ${file}:`, error);
      }
    }
  }
}

// src/handlers/CommandHandler.ts - Command Handler
import { ChatInputCommandInteraction, CacheType, Collection } from 'discord.js';

export class CommandHandler {
  private client: ExtendedClient;
  private logger: Logger;

  constructor(client: ExtendedClient, logger: Logger) {
    this.client = client;
    this.logger = logger;
  }

  async handleInteraction(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const command = this.client.commands.get(interaction.commandName);

    if (!command) {
      await interaction.reply({ content: 'Command not found!', ephemeral: true });
      return;
    }

    // Check cooldowns
    if (!this.client.cooldowns.has(command.data.name)) {
      this.client.cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = this.client.cooldowns.get(command.data.name)!;
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        await interaction.reply({
          content: `Please wait ${timeLeft.toFixed(1)} more seconds before using this command.`,
          ephemeral: true
        });
        return;
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await command.execute(interaction);
    } catch (error) {
      this.logger.error(`Error executing command ${command.data.name}:`, error);
      
      const errorMessage = 'There was an error while executing this command!';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
}

// src/database/DatabaseManager.ts - Database Manager
import { PrismaClient } from '@prisma/client';

export class DatabaseManager {
  private db: PrismaClient;
  private logger: Logger;

  constructor(db: PrismaClient, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    try {
      // Test database connection
      await this.db.$queryRaw`SELECT 1`;
      
      // Run any necessary migrations or setup
      this.logger.info('Database manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize database manager:', error);
      throw error;
    }
  }

  async createGuildIfNotExists(guildId: string, guildName: string): Promise<void> {
    try {
      await this.db.guild.upsert({
        where: { id: guildId },
        update: { name: guildName },
        create: {
          id: guildId,
          name: guildName
        }
      });
    } catch (error) {
      this.logger.error('Failed to create/update guild:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.db.$disconnect();
      this.logger.info('Database disconnected');
    } catch (error) {
      this.logger.error('Error during database cleanup:', error);
    }
  }
}