import { 
  Events, 
  Interaction, 
  ChatInputCommandInteraction, 
  AutocompleteInteraction, 
  ButtonInteraction, 
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction
} from 'discord.js';
import { logger } from '../utils/logger';
import { t } from '../i18n';
import type { Command } from '../types/command';
import { handleWarningActionButtons } from '../interactions/buttons/warningActions';
import { handleWarningModals } from '../interactions/modals/warningModals';
import { handleConfigButton } from '../interactions/buttons/configButtons';
import { handleConfigModal } from '../interactions/modals/configModals';
import { handleConfigSelectMenu } from '../interactions/selectMenus/configSelectMenus';
import { handleTicketButton } from '../interactions/buttons/ticketButtons';
import { handleTicketModal } from '../interactions/modals/ticketModals';
import { handleXPButtons } from '../interactions/buttons/xpButtons';
import { handleXPModals } from '../interactions/modals/xpModals';
import { db } from '../database/drizzle';
import { blacklist } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { securityMiddleware } from '../security/middleware';
import { SecurityErrorHandler } from '../security/errors';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
  } else if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
  } else if (interaction.isButton()) {
    await handleButton(interaction);
  } else if (interaction.isModalSubmit()) {
    await handleModal(interaction);
  } else if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
    await handleSelectMenu(interaction);
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  const command = interaction.client.commands.get(interaction.commandName) as Command;

  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    // Apply security middleware
    const securityCheck = await securityMiddleware(interaction, command);
    if (!securityCheck.passed) {
      // Security check failed - middleware handles the response
      return;
    }

    // Execute the command
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);
    
    // Handle security errors specially
    const errorResponse = await SecurityErrorHandler.handle(error as Error);
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: errorResponse.message,
        embeds: errorResponse.embed ? [errorResponse.embed] : undefined,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: errorResponse.message,
        embeds: errorResponse.embed ? [errorResponse.embed] : undefined,
        ephemeral: true,
      });
    }
  }
}

async function handleAutocomplete(interaction: AutocompleteInteraction) {
  const command = interaction.client.commands.get(interaction.commandName) as Command;

  if (!command || !command.autocomplete) {
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    logger.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
  }
}

async function handleButton(interaction: ButtonInteraction) {
  try {
    // Handle warning action buttons
    if (interaction.customId.startsWith('warn_action:') || interaction.customId.startsWith('warn_view:')) {
      await handleWarningActionButtons(interaction);
      return;
    }

    // Handle config buttons
    if (interaction.customId.startsWith('config_')) {
      await handleConfigButton(interaction);
      return;
    }

    // Handle ticket buttons
    if (interaction.customId.startsWith('ticket_')) {
      await handleTicketButton(interaction);
      return;
    }

    // Handle XP buttons
    if (interaction.customId.startsWith('xp_')) {
      await handleXPButtons(interaction);
      return;
    }

    // Add other button handlers here as needed
  } catch (error) {
    logger.error(`Error handling button ${interaction.customId}:`, error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: t('common.error'),
        ephemeral: true,
      });
    }
  }
}

async function handleModal(interaction: ModalSubmitInteraction) {
  try {
    // Handle warning modals
    if (interaction.customId.startsWith('warn_edit:') || interaction.customId === 'warn_automation_create') {
      await handleWarningModals(interaction);
      return;
    }

    // Handle config modals
    if (interaction.customId.startsWith('config_')) {
      await handleConfigModal(interaction);
      return;
    }

    // Handle ticket modals
    if (interaction.customId.startsWith('ticket_')) {
      await handleTicketModal(interaction);
      return;
    }

    // Handle XP modals
    if (interaction.customId === 'xp_card_customization') {
      await handleXPModals(interaction);
      return;
    }

    // Add other modal handlers here as needed
  } catch (error) {
    logger.error(`Error handling modal ${interaction.customId}:`, error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: t('common.error'),
        ephemeral: true,
      });
    }
  }
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction | RoleSelectMenuInteraction) {
  try {
    // Handle config select menus
    if (interaction.customId.startsWith('config_')) {
      await handleConfigSelectMenu(interaction);
      return;
    }

    // Add other select menu handlers here as needed
  } catch (error) {
    logger.error(`Error handling select menu ${interaction.customId}:`, error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: t('common.error'),
        ephemeral: true,
      });
    }
  }
}