
// src/handlers/CommandHandler.ts - Fixed Command Handler
import { ChatInputCommandInteraction, CacheType, Collection } from 'discord.js';
import { ExtendedClient } from '..';
import { Logger } from '@/utils/Logger';

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