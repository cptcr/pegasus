import { Events, ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import { ExtendedClient } from '../types';
import { createErrorEmbed } from '../utils/helpers';
import { statsHandler } from '../handlers/stats';
import { ticketHandler } from '../handlers/tickets';
import { gameHandler } from '../handlers/games';
import { reactionRolesHandler } from '../handlers/reactionRoles';

export const event = {
  name: Events.InteractionCreate,
  async execute(interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction) {
    const client = interaction.client as ExtendedClient;

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
        
        // Track command usage
        if (interaction.guild) {
          await statsHandler.incrementCommandCount(interaction.guild.id);
        }
      } catch (error) {
        console.error('Error executing command:', error);
        
        const errorEmbed = createErrorEmbed(
          'Command Error',
          'There was an error while executing this command!'
        );

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      }
    }

    if (interaction.isButton()) {
      try {
        await ticketHandler.handleButtonInteraction(interaction);
        await gameHandler.handleButtonInteraction(interaction);
        await reactionRolesHandler.handleButtonInteraction(interaction);
      } catch (error) {
        console.error('Error handling button interaction:', error);
      }
    }

    if (interaction.isStringSelectMenu()) {
      try {
        await reactionRolesHandler.handleSelectMenuInteraction(interaction);
      } catch (error) {
        console.error('Error handling select menu interaction:', error);
      }
    }

    if (interaction.isModalSubmit()) {
      try {
        await ticketHandler.handleModalSubmit(interaction);
      } catch (error) {
        console.error('Error handling modal submit:', error);
      }
    }
  },
};