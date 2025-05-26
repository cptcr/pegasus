// src/handlers/ButtonHandler.ts - Fixed and Completed Button Interaction Handler
import { ButtonInteraction } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { QuarantineManager } from '../modules/quarantine/QuarantineManager.js';
import { PollManager } from '../modules/polls/PollManager.js';
import { GiveawayManager } from '../modules/giveaways/GiveawayManager.js';
import { TicketManager } from '../modules/tickets/TicketManager.js';
import { Join2CreateManager } from '../modules/voice/Join2CreateManager.js';

export class ButtonHandler {
  private client: ExtendedClient;
  private quarantineManager: QuarantineManager;
  private pollManager: PollManager;
  private giveawayManager: GiveawayManager;
  private ticketManager: TicketManager;
  private j2cManager: Join2CreateManager;

  constructor(client: ExtendedClient) {
    this.client = client;
    this.quarantineManager = new QuarantineManager(client, client.db, client.logger);
    this.pollManager = new PollManager(client, client.db, client.logger);
    this.giveawayManager = new GiveawayManager(client, client.db, client.logger);
    this.ticketManager = new TicketManager(client, client.db, client.logger);
    this.j2cManager = new Join2CreateManager(client, client.db, client.logger);
  }

  /**
   * Handles all button interactions and routes them to the appropriate manager.
   * Assumes button custom IDs are in the format "prefix:action:data"
   * e.g., "giveaway:enter:12345" or "ticket:close"
   * @param interaction The ButtonInteraction to handle.
   */
  public async handle(interaction: ButtonInteraction): Promise<void> {
    // We only handle buttons from within guilds.
    if (!interaction.guild) return;

    const [prefix] = interaction.customId.split(':');

    try {
      switch (prefix) {
        case 'giveaway':
          // Delegate to the GiveawayManager to handle entries
          await this.giveawayManager.handleButtonInteraction(interaction);
          break;

        case 'poll':
          // Delegate to the PollManager to handle votes
          await this.pollManager.handleButtonInteraction(interaction);
          break;

        case 'ticket':
          // Delegate to the TicketManager for actions like close, claim, etc.
          await this.ticketManager.handleButtonInteraction(interaction);
          break;

        case 'quarantine':
          // Delegate to the QuarantineManager for moderator actions
          await this.quarantineManager.handleButtonInteraction(interaction);
          break;
        
        case 'j2c': // Prefix for Join2Create buttons
          // Delegate to the Join2CreateManager for channel owner actions
          await this.j2cManager.handleButtonInteraction(interaction);
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