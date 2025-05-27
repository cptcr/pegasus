// src/handlers/ButtonHandler.ts - Fixed Button Interaction Handler
import { ButtonInteraction } from 'discord.js';
import { ExtendedClient } from '../index.js';

export class ButtonHandler {
  private client: ExtendedClient;

  constructor(client: ExtendedClient) {
    this.client = client;
  }

  /**
   * Handles all button interactions and routes them to the appropriate manager.
   * Supports both old format (prefix_id) and new format (prefix:action:id)
   * @param interaction The ButtonInteraction to handle.
   */
  public async handle(interaction: ButtonInteraction): Promise<void> {
    // We only handle buttons from within guilds.
    if (!interaction.guild) return;

    // Support both old and new custom ID formats
    let prefix: string;
    
    if (interaction.customId.includes(':')) {
      // New format: "prefix:action:data"
      [prefix] = interaction.customId.split(':');
    } else if (interaction.customId.includes('_')) {
      // Old format: "prefix_data"
      [prefix] = interaction.customId.split('_');
    } else {
      // Single word prefix
      prefix = interaction.customId;
    }

    try {
      switch (prefix) {
        case 'giveaway':
          // Delegate to the GiveawayManager to handle entries
          await this.client.giveawayManager.handleButtonInteraction(interaction);
          break;

        case 'poll':
          // Delegate to the PollManager to handle votes
          await this.client.pollManager.handleButtonInteraction(interaction);
          break;

        case 'ticket':
          // Delegate to the TicketManager for actions like close, claim, etc.
          await this.client.ticketManager.handleButtonInteraction(interaction);
          break;

        case 'quarantine':
          // Delegate to the QuarantineManager for moderator actions
          await this.client.quarantineManager.handleButtonInteraction(interaction);
          break;
        
        case 'j2c': // Prefix for Join2Create buttons
          // Delegate to the Join2CreateManager for channel owner actions
          await this.client.j2cManager.handleButtonInteraction(interaction);
          break;

        default:
          this.client.logger.warn(`[ButtonHandler] Received a button with an unknown prefix: ${prefix}`);
          await interaction.reply({ content: 'This button is either unknown or has expired.', ephemeral: true });
          break;
      }
    } catch (error) {
      this.client.logger.error(`[ButtonHandler] An error occurred while handling button ${interaction.customId}:`, error);
      // Inform the user that something went wrong without exposing details
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred while processing this action. Please try again later.', ephemeral: true });
      } else {
        await interaction.followUp({ content: 'An error occurred while processing this action. Please try again later.', ephemeral: true });
      }
    }
  }
}