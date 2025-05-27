// src/events/interactionCreate.ts
import { Interaction, Collection, BaseInteraction } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { BotEvent } from '../types/index.js';
import { Config } from '../config/Config.js';

const event: BotEvent<'interactionCreate'> = {
  name: 'interactionCreate',
  async execute(client: ExtendedClient, interaction: BaseInteraction) {
    if (!interaction.isChatInputCommand()) {
        if(interaction.isButton()) {
            await client.buttonHandler.handle(interaction);
        }
        return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      client.logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }
    
    // Cooldown Logic
    const { cooldowns } = client;
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name)!;
    const cooldownAmount = (command.cooldown ?? Config.COOLDOWNS.GLOBAL) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        await interaction.reply({
          content: `Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`/${command.data.name}\` command.`,
          ephemeral: true,
        });
        return;
      }
    }
    
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    
    // Command Execution with Error Handling
    try {
      await command.execute(interaction, client);
    } catch (error) {
      client.logger.error(`Error executing command: ${interaction.commandName}`, error);
      const errorMessage = { content: 'There was an error while executing this command! The developers have been notified.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(err => client.logger.error("Failed to send follow-up error message:", err));
      } else {
        await interaction.reply(errorMessage).catch(err => client.logger.error("Failed to send reply error message:", err));
      }
    }
  },
};

export default event;