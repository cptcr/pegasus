
// src/events/interactionCreate.ts - Interaction Handler Event
import { Events, Interaction } from 'discord.js';
import { ButtonHandler } from '../handlers/ButtonHandler.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, client: ExtendedClient) {
    try {
      if (interaction.isChatInputCommand()) {
        // Handle slash commands
        const command = client.commands.get(interaction.commandName);

        if (!command) {
          await interaction.reply({ 
            content: 'This command no longer exists!', 
            ephemeral: true 
          });
          return;
        }

        // Check cooldowns
        if (!client.cooldowns.has(command.data.name)) {
          client.cooldowns.set(command.data.name, new Collection());
        }

        const now = Date.now();
        const timestamps = client.cooldowns.get(command.data.name)!;
        const cooldownAmount = (command.cooldown || 3) * 1000;

        if (timestamps.has(interaction.user.id)) {
          const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

          if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return interaction.reply({
              content: `Please wait ${timeLeft.toFixed(1)} more seconds before using this command.`,
              ephemeral: true
            });
          }
        }

        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

        // Execute command
        await command.execute(interaction);

      } else if (interaction.isButton()) {
        // Handle button interactions
        const buttonHandler = new ButtonHandler(client);
        await buttonHandler.handleButtonInteraction(interaction);

      } else if (interaction.isStringSelectMenu()) {
        // Handle select menu interactions
        client.logger.debug(`Select menu interaction: ${interaction.customId}`);
        
      } else if (interaction.isModalSubmit()) {
        // Handle modal submissions
        client.logger.debug(`Modal submission: ${interaction.customId}`