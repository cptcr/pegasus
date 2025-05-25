// src/events/interactionCreate.ts - Handle slash command interactions
import { Events, Interaction } from 'discord.js';
import { Client, Event } from '../types';
import { handleCooldown } from '../utils/cooldown';

const event: Event<typeof Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    const client = interaction.client as Client;

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.slashCommands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      // Check for dev-only commands
      if (command.devOnly && !client.config.devUsers.includes(interaction.user.id)) {
        await interaction.reply({ 
          content: '⚠️ This command can only be used by bot developers.', 
          ephemeral: true 
        });
        return;
      }

      // Handle command cooldowns
      const cooldownResult = handleCooldown({
        userId: interaction.user.id,
        commandName: interaction.commandName,
        cooldownAmount: command.cooldown || 0,
      }, client);

      if (cooldownResult.onCooldown) {
        await interaction.reply({ 
          content: `⏱️ Please wait ${cooldownResult.remainingTime.toFixed(1)} more seconds before using this command again.`, 
          ephemeral: true 
        });
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        const errorMessage = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ 
            content: errorMessage, 
            ephemeral: true 
          });
        } else {
          await interaction.reply({ 
            content: errorMessage, 
            ephemeral: true 
          });
        }
      }
    }

    // Handle other interaction types as needed (buttons, select menus, etc.)
    else if (interaction.isButton()) {
      // Handle button interactions
    }
    else if (interaction.isStringSelectMenu()) {
      // Handle select menu interactions
    }
    else if (interaction.isModalSubmit()) {
      // Handle modal submissions
    }
  }
};

export default event;




