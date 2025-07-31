import { Events, ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, AutocompleteInteraction } from 'discord.js';
import { ExtendedClient } from '../types';
import { createErrorEmbed } from '../utils/helpers';
import { statsHandler } from '../handlers/stats';
import { ticketHandler } from '../handlers/tickets';
import { ticketAnalytics } from '../handlers/ticketAnalytics';
import { gameHandler } from '../handlers/games';
import { reactionRolesHandler } from '../handlers/reactionRoles';
import { giveawayHandler } from '../handlers/giveaway';
import { dynamicCommandHandler } from '../handlers/dynamicCommands';
import { guildCommandHandler } from '../handlers/guildCommands';
import { security } from '../security/middleware';
import { logger } from '../utils/logger';
import * as subcommandModule from '../commands/utility/subcommand';
import * as customcommandModule from '../commands/utility/customcommand';

export const event = {
  name: Events.InteractionCreate,
  async execute(interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | AutocompleteInteraction) {
    const client = interaction.client as ExtendedClient;

    // Skip security checks for autocomplete
    if (!interaction.isAutocomplete()) {
      // Apply security middleware
      const securityCheck = await security.checkInteraction(interaction);
      if (!securityCheck.allowed) {
        if (interaction.isChatInputCommand() || interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
          await interaction.reply({
            content: `🛡️ ${securityCheck.reason}`,
            ephemeral: true
          });
        }
        return;
      }
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      try {
        // First check if this is a guild-installed custom command
        if (interaction.guild) {
          const handled = await guildCommandHandler.execute(interaction);
          if (handled) {
            // Track command usage
            await statsHandler.incrementCommandCount(interaction.guild.id);
            return;
          }
        }

        // Then check if this might be a dynamic custom subcommand (legacy)
        if (interaction.guild && interaction.options.getSubcommand(false)) {
          const handled = await dynamicCommandHandler.execute(interaction);
          if (handled) {
            // Track command usage
            await statsHandler.incrementCommandCount(interaction.guild.id);
            return;
          }
        }

        // Finally, execute the regular command
        if (!command) {
          console.error(`No command matching ${interaction.commandName} was found.`);
          return;
        }

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
        // Handle giveaway button interactions
        if (interaction.customId.startsWith('giveaway_enter_')) {
          const giveawayId = interaction.customId.split('_')[2];
          const result = await giveawayHandler.enterGiveaway(giveawayId, interaction.user.id, interaction.guild!.id);
          
          if (result.success) {
            await interaction.reply({
              content: `✅ ${result.message}`,
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: `❌ ${result.message}`,
              ephemeral: true
            });
          }
          return;
        }

        // Handle ticket system button interactions
        if (interaction.customId.startsWith('ticket_') || interaction.customId.startsWith('analytics_')) {
          if (interaction.customId.startsWith('analytics_')) {
            await ticketAnalytics.handleAnalyticsButtons(interaction);
          } else {
            await ticketHandler.handleButtonInteraction(interaction);
          }
          return;
        }

        await gameHandler.handleButtonInteraction(interaction);
        await reactionRolesHandler.handleButtonInteraction(interaction);
      } catch (error) {
        console.error('Error handling button interaction:', error);
      }
    }

    if (interaction.isStringSelectMenu()) {
      try {
        // Handle ticket system select menu interactions
        if (interaction.customId.startsWith('ticket_') || interaction.customId.startsWith('analytics_')) {
          if (interaction.customId.startsWith('analytics_')) {
            await ticketAnalytics.handlePeriodSelection(interaction);
          } else {
            await ticketHandler.handleSelectMenuInteraction(interaction);
          }
          return;
        }

        await reactionRolesHandler.handleSelectMenuInteraction(interaction);
      } catch (error) {
        console.error('Error handling select menu interaction:', error);
      }
    }

    if (interaction.isModalSubmit()) {
      try {
        // Handle subcommand creation modals (legacy)
        if (interaction.customId.startsWith('subcommand_create_')) {
          await subcommandModule.handleModalSubmit(interaction);
          return;
        }

        // Handle guild command creation modals
        if (interaction.customId.startsWith('guildcommand_create_')) {
          await customcommandModule.handleModalSubmit(interaction);
          return;
        }

        // Handle ticket system modal submissions
        if (interaction.customId.startsWith('ticket_')) {
          await ticketHandler.handleModalSubmit(interaction);
          await ticketHandler.handleAdditionalModals(interaction);
          return;
        }
      } catch (error) {
        console.error('Error handling modal submit:', error);
      }
    }

    if (interaction.isAutocomplete()) {
      try {
        const command = client.commands.get(interaction.commandName);
        
        if (!command || !command.autocomplete) {
          return;
        }

        await command.autocomplete(interaction);
      } catch (error) {
        console.error('Error handling autocomplete:', error);
      }
    }
  },
};