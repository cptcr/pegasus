// src/events/interactionCreate.ts - Fixed Interaction Handler
import { Collection, BaseInteraction } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { BotEvent } from '../types/index.js';
import { Config } from '../config/Config.js';

const event: BotEvent<'interactionCreate'> = {
  name: 'interactionCreate',
  async execute(client: ExtendedClient, interaction: BaseInteraction) {
    // Handle button interactions
    if (interaction.isButton()) {
      await client.buttonHandler.handle(interaction);
      return;
    }

    // Handle chat input commands
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      client.logger.error(`❌ No command matching ${interaction.commandName} was found.`);
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
          content: `⏳ Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`/${command.data.name}\` command.`,
          ephemeral: true,
        });
        return;
      }
    }
    
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    
    // Command Execution with Error Handling
    try {
      client.logger.debug(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
      await command.execute(interaction, client);
      
      // Log successful command execution
      client.logger.info(`✅ Command executed: /${interaction.commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
      
    } catch (error) {
      client.logger.error(`❌ Error executing command: ${interaction.commandName}`, error);
      
      const errorMessage = { 
        content: '❌ There was an error while executing this command! The developers have been notified.', 
        ephemeral: true 
      };
      
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      } catch (followUpError) {
        client.logger.error("❌ Failed to send error message:", followUpError);
      }
    }
  },
};

export default event;