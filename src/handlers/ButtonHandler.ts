// src/handlers/ButtonHandler.ts - Fixed Button Interaction Handler
import { ButtonInteraction, PermissionFlagsBits } from 'discord.js';
import { ExtendedClient } from '../index.js';
import { QuarantineManager } from '../modules/quarantine/QuarantineManager.js';
import { PollManager } from '../modules/polls/PollManager.js';
import { GiveawayManager } from '../modules/giveaways/GiveawayManager.js';
import { TicketManager } from '../modules/tickets/TicketManager.js';

export class ButtonHandler {
  private client: ExtendedClient;
  private quarantineManager: QuarantineManager;
  private pollManager: PollManager;
  private giveawayManager: GiveawayManager;
  private ticketManager: TicketManager;

  constructor(client: ExtendedClient) {
    this.client = client;
    this.quarantineManager = new QuarantineManager(client, client.db, client.logger);
    this.pollManager = new PollManager(client, client.db, client.logger);
    this.giveawayManager = new GiveawayManager(client, client.db, client.logger);
    this.ticketManager = new TicketManager(client, client.db, client.logger);
  }

  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      const customId = interaction.customId;

      // Quarantine buttons
      if (customId.startsWith('quarantine_')) {
        await this.handleQuarantineButton(interaction);
        return;
      }

      // Poll buttons
      if (customId.startsWith('poll_')) {
        await this.pollManager.handleVote(interaction);
        return;
      }

      // Giveaway buttons
      if (customId.startsWith('giveaway_')) {
        await this.giveawayManager.handleEntry(interaction);
        return;
      }

      // Ticket buttons
      if (customId.startsWith('ticket_')) {
        await this.handleTicketButton(interaction);
        return;
      }

      // Unknown button
      await interaction.reply({ content: 'Unknown button interaction.', ephemeral: true });

    } catch (error) {
      this.client.logger.error('Error handling button interaction:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing your request.', 
          ephemeral: true 
        });
      }
    }
  }

  private async handleQuarantineButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;

    const [, action, userId] = interaction.customId.split('_');
    
    // Check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: 'You do not have permission to use this button.', ephemeral: true });
      return;
    }

    if (action === 'remove') {
      const result = await this.quarantineManager.unquarantineUser(
        interaction.guild,
        userId,
        interaction.user.id,
        'Removed via button'
      );

      if (result.success) {
        await interaction.reply({ content: 'User removed from quarantine.', ephemeral: true });
      } else {
        await interaction.reply({ content: `Failed to remove quarantine: ${result.error}`, ephemeral: true });
      }
    }
  }

  private async handleTicketButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;

    const [, action, ticketId] = interaction.customId.split('_');

    if (action === 'close') {
      // Check if user is ticket owner or has staff permissions
      const ticket = await this.ticketManager.getTicket(parseInt(ticketId));
      
      if (!ticket) {
        await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
        return;
      }

      const isOwner = ticket.userId === interaction.user.id;
      const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);

      if (!isOwner && !isStaff) {
        await interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });
      }

      const result = await this.ticketManager.closeTicket(parseInt(ticketId), interaction.user.id);

      if (result.success) {
        await interaction.reply({ content: 'Ticket closed successfully.', ephemeral: true });
      } else {
        await interaction.reply({ content: `Failed to close ticket: ${result.error}`, ephemeral: true });
      }
    }
  }
}