// Advanced ticket handler methods - part of the comprehensive ticket system
import { 
  ButtonInteraction,
  SelectMenuInteraction,
  ModalSubmitInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  AttachmentBuilder,
  TextChannel,
  GuildMember,
  Guild,
  User,
  Message,
  Collection
} from 'discord.js';
import { db } from '../database/connection';
import { createEmbed, createSuccessEmbed, createErrorEmbed, createWarningEmbed } from '../utils/helpers';
import { colors, emojis } from '../utils/config';
import { i18n } from '../i18n';
import * as fs from 'fs/promises';
import * as path from 'path';

export class TicketMethods {
  
  // Priority management
  async handlePriorityChange(interaction: ButtonInteraction, ticketId: string): Promise<void> {
    if (!interaction.guild) return;

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.not_found', { lng: 'en', fallbackValue: 'Ticket not found.' })
        )],
        ephemeral: true,
      });
      return;
    }

    if (!await this.canManageTickets(interaction.member as GuildMember, interaction.guild.id)) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.no_permission', { lng: 'en', fallbackValue: 'You do not have permission to manage tickets.' })
        )],
        ephemeral: true,
      });
      return;
    }

    const category = ticket.category_id ? await this.getTicketCategory(ticket.category_id) : null;
    const priorities = category?.priority_levels || ['low', 'medium', 'high', 'urgent'];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_priority_${ticketId}`)
      .setPlaceholder('Select new priority level')
      .setMinValues(1)
      .setMaxValues(1);

    const priorityEmojis = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      urgent: '🔴'
    };

    for (const priority of priorities) {
      selectMenu.addOptions({
        label: priority.charAt(0).toUpperCase() + priority.slice(1),
        value: priority,
        emoji: priorityEmojis[priority as keyof typeof priorityEmojis],
        default: ticket.priority === priority
      });
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = createEmbed({
      title: '📊 Change Ticket Priority',
      description: `Current priority: **${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}**`,
      color: colors.primary,
    });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }

  async handlePrioritySelection(interaction: SelectMenuInteraction, ticketId: string): Promise<void> {
    const newPriority = interaction.values[0];
    
    await interaction.deferUpdate();

    try {
      const oldTicket = await this.getTicket(ticketId);
      if (!oldTicket) return;

      await db.query(
        'UPDATE tickets SET priority = $1 WHERE id = $2',
        [newPriority, ticketId]
      );

      // Log activity
      await this.logTicketActivity(ticketId, interaction.user.id, 'priority_changed', {
        old_priority: oldTicket.priority,
        new_priority: newPriority
      });

      const priorityEmojis = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        urgent: '🔴'
      };

      const embed = createSuccessEmbed(
        '✅ Priority Updated',
        `Ticket priority changed to ${priorityEmojis[newPriority as keyof typeof priorityEmojis]} **${newPriority.charAt(0).toUpperCase() + newPriority.slice(1)}**`
      );

      await interaction.editReply({
        embeds: [embed],
        components: []
      });

      // Update original ticket message if possible
      const channel = interaction.guild?.channels.cache.get(oldTicket.channel_id) as TextChannel;
      if (channel) {
        try {
          const messages = await channel.messages.fetch({ limit: 10 });
          const ticketMessage = messages.find(msg => 
            msg.author.id === interaction.client.user?.id && 
            msg.embeds.length > 0 &&
            msg.embeds[0].footer?.text?.includes(ticketId)
          );

          if (ticketMessage && ticketMessage.embeds[0]) {
            const updatedEmbed = EmbedBuilder.from(ticketMessage.embeds[0]);
            const priorityField = updatedEmbed.data.fields?.find(field => field.name.includes('Priority'));
            if (priorityField) {
              priorityField.value = `${priorityEmojis[newPriority as keyof typeof priorityEmojis]} ${newPriority.charAt(0).toUpperCase() + newPriority.slice(1)}`;
            }
            
            await ticketMessage.edit({ embeds: [updatedEmbed] });
          }
        } catch (error) {
          console.error('Error updating ticket message:', error);
        }
      }

      // Log to designated channel
      const settings = await this.getTicketSettings(interaction.guild!.id);
      if (settings.log_channel_id && settings.log_events.includes('priority_changed')) {
        await this.logTicketEvent(interaction.guild!, {
          type: 'priority_changed',
          ticket: { id: ticketId, subject: oldTicket.subject, channel_id: oldTicket.channel_id },
          user: interaction.user,
          details: { old_priority: oldTicket.priority, new_priority: newPriority }
        });
      }

    } catch (error) {
      console.error('Error updating ticket priority:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.priority_update_failed', { lng: 'en', fallbackValue: 'Failed to update ticket priority.' })
        )],
        components: []
      });
    }
  }

  // User management
  async handleAddUser(interaction: ButtonInteraction, ticketId: string): Promise<void> {
    if (!interaction.guild) return;

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.not_found', { lng: 'en', fallbackValue: 'Ticket not found.' })
        )],
        ephemeral: true,
      });
      return;
    }

    const canManage = ticket.user_id === interaction.user.id || 
                      await this.canManageTickets(interaction.member as GuildMember, interaction.guild.id);
                      
    if (!canManage) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.no_permission', { lng: 'en', fallbackValue: 'You do not have permission to manage this ticket.' })
        )],
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`ticket_adduser_modal_${ticketId}`)
      .setTitle('Add User to Ticket');

    const userInput = new TextInputBuilder()
      .setCustomId('user_input')
      .setLabel('User ID or @mention')
      .setPlaceholder('Enter user ID or mention the user')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(userInput)
    );

    await interaction.showModal(modal);
  }

  async handleAddUserModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.customId.startsWith('ticket_adduser_modal_')) return;
    
    const ticketId = interaction.customId.split('_')[3];
    const userInput = interaction.fields.getTextInputValue('user_input');
    
    await interaction.deferReply({ ephemeral: true });

    try {
      // Parse user ID from input
      const userIdMatch = userInput.match(/(\d{17,19})/);
      if (!userIdMatch) {
        await interaction.editReply({
          embeds: [createErrorEmbed(
            i18n.t('common.error', { lng: 'en' }),
            'Invalid user ID or mention format. Please provide a valid user ID or mention.'
          )]
        });
        return;
      }

      const userId = userIdMatch[1];
      const user = await interaction.client.users.fetch(userId).catch(() => null);
      
      if (!user) {
        await interaction.editReply({
          embeds: [createErrorEmbed(
            i18n.t('common.error', { lng: 'en' }),
            'User not found. Please check the user ID or mention.'
          )]
        });
        return;
      }

      const ticket = await this.getTicket(ticketId);
      if (!ticket) {
        await interaction.editReply({
          embeds: [createErrorEmbed(
            i18n.t('common.error', { lng: 'en' }),
            i18n.t('tickets.not_found', { lng: 'en', fallbackValue: 'Ticket not found.' })
          )]
        });
        return;
      }

      // Check if user is already a participant
      const existingParticipant = await db.query(
        'SELECT id FROM ticket_participants WHERE ticket_id = $1 AND user_id = $2 AND removed_at IS NULL',
        [ticketId, userId]
      );

      if (existingParticipant.rows.length > 0) {
        await interaction.editReply({
          embeds: [createErrorEmbed(
            i18n.t('common.error', { lng: 'en' }),
            `${user.tag} is already a participant in this ticket.`
          )]
        });
        return;
      }

      // Add user to ticket participants
      await db.query(
        'INSERT INTO ticket_participants (ticket_id, user_id, added_by) VALUES ($1, $2, $3)',
        [ticketId, userId, interaction.user.id]
      );

      // Add user to channel permissions
      const channel = interaction.guild?.channels.cache.get(ticket.channel_id) as TextChannel;
      if (channel) {
        await channel.permissionOverwrites.edit(userId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true
        });
      }

      // Log activity
      await this.logTicketActivity(ticketId, interaction.user.id, 'user_added', {
        added_user_id: userId,
        added_user_tag: user.tag
      });

      const embed = createSuccessEmbed(
        '✅ User Added',
        `${user} has been added to this ticket.`
      );

      await interaction.editReply({ embeds: [embed] });

      // Send notification in ticket channel
      if (channel) {
        const notificationEmbed = createEmbed({
          title: '👥 User Added to Ticket',
          description: `${user} has been added to this ticket by ${interaction.user}`,
          color: colors.success,
          timestamp: true
        });

        await channel.send({ 
          content: user.toString(),
          embeds: [notificationEmbed] 
        });
      }

    } catch (error) {
      console.error('Error adding user to ticket:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          'Failed to add user to ticket. Please try again.'
        )]
      });
    }
  }

  async handleRemoveUser(interaction: ButtonInteraction, ticketId: string): Promise<void> {
    if (!interaction.guild) return;

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.not_found', { lng: 'en', fallbackValue: 'Ticket not found.' })
        )],
        ephemeral: true,
      });
      return;
    }

    const canManage = ticket.user_id === interaction.user.id || 
                      await this.canManageTickets(interaction.member as GuildMember, interaction.guild.id);
                      
    if (!canManage) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.no_permission', { lng: 'en', fallbackValue: 'You do not have permission to manage this ticket.' })
        )],
        ephemeral: true,
      });
      return;
    }

    // Get current participants
    const participants = await db.query(
      `SELECT tp.user_id, tp.added_at FROM ticket_participants tp 
       WHERE tp.ticket_id = $1 AND tp.removed_at IS NULL AND tp.user_id != $2`,
      [ticketId, ticket.user_id] // Exclude ticket creator
    );

    if (participants.rows.length === 0) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          'No additional participants to remove from this ticket.'
        )],
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_removeuser_${ticketId}`)
      .setPlaceholder('Select user to remove')
      .setMinValues(1)
      .setMaxValues(1);

    for (const participant of participants.rows) {
      try {
        const user = await interaction.client.users.fetch(participant.user_id);
        selectMenu.addOptions({
          label: user.tag,
          value: participant.user_id,
          description: `Added ${new Date(participant.added_at).toLocaleDateString()}`
        });
      } catch (error) {
        // User not found, add with ID only
        selectMenu.addOptions({
          label: `Unknown User (${participant.user_id})`,
          value: participant.user_id,
          description: `Added ${new Date(participant.added_at).toLocaleDateString()}`
        });
      }
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = createEmbed({
      title: '👥 Remove User from Ticket',
      description: 'Select a user to remove from this ticket.',
      color: colors.warning,
    });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }

  async handleUserRemoveSelection(interaction: SelectMenuInteraction, ticketId: string): Promise<void> {
    const userIdToRemove = interaction.values[0];
    
    await interaction.deferUpdate();

    try {
      const user = await interaction.client.users.fetch(userIdToRemove).catch(() => null);
      const ticket = await this.getTicket(ticketId);
      
      // Update participant record
      await db.query(
        'UPDATE ticket_participants SET removed_at = $1, removed_by = $2 WHERE ticket_id = $3 AND user_id = $4',
        [new Date(), interaction.user.id, ticketId, userIdToRemove]
      );

      // Remove user from channel permissions
      const channel = interaction.guild?.channels.cache.get(ticket.channel_id) as TextChannel;
      if (channel) {
        await channel.permissionOverwrites.delete(userIdToRemove);
      }

      // Log activity
      await this.logTicketActivity(ticketId, interaction.user.id, 'user_removed', {
        removed_user_id: userIdToRemove,
        removed_user_tag: user?.tag || 'Unknown User'
      });

      const embed = createSuccessEmbed(
        '✅ User Removed',
        `${user?.tag || 'User'} has been removed from this ticket.`
      );

      await interaction.editReply({
        embeds: [embed],
        components: []
      });

      // Send notification in ticket channel
      if (channel) {
        const notificationEmbed = createEmbed({
          title: '👥 User Removed from Ticket',
          description: `${user?.tag || 'A user'} has been removed from this ticket by ${interaction.user}`,
          color: colors.warning,
          timestamp: true
        });

        await channel.send({ embeds: [notificationEmbed] });
      }

    } catch (error) {
      console.error('Error removing user from ticket:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          'Failed to remove user from ticket. Please try again.'
        )],
        components: []
      });
    }
  }

  // Transcript generation
  async handleTranscriptGeneration(interaction: ButtonInteraction, ticketId: string): Promise<void> {
    if (!interaction.guild) return;

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.not_found', { lng: 'en', fallbackValue: 'Ticket not found.' })
        )],
        ephemeral: true,
      });
      return;
    }

    if (!await this.canManageTickets(interaction.member as GuildMember, interaction.guild.id)) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.no_permission', { lng: 'en', fallbackValue: 'You do not have permission to generate transcripts.' })
        )],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = interaction.guild.channels.cache.get(ticket.channel_id) as TextChannel;
      if (!channel) {
        await interaction.editReply({
          embeds: [createErrorEmbed(
            i18n.t('common.error', { lng: 'en' }),
            'Ticket channel not found.'
          )]
        });
        return;
      }

      const transcript = await this.generateTranscript(ticket, channel);
      if (!transcript) {
        await interaction.editReply({
          embeds: [createErrorEmbed(
            i18n.t('common.error', { lng: 'en' }),
            'Failed to generate transcript.'
          )]
        });
        return;
      }

      // Log activity
      await this.logTicketActivity(ticketId, interaction.user.id, 'transcript_generated');

      const embed = createSuccessEmbed(
        '📄 Transcript Generated',
        'The ticket transcript has been generated successfully.'
      );

      const files = transcript.file ? [transcript.file] : [];

      await interaction.editReply({
        embeds: [embed, transcript.embed],
        files
      });

    } catch (error) {
      console.error('Error generating transcript:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          'Failed to generate transcript. Please try again.'
        )]
      });
    }
  }

  // Ticket deletion (staff only)
  async handleTicketDelete(interaction: ButtonInteraction, ticketId: string): Promise<void> {
    if (!interaction.guild) return;

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.not_found', { lng: 'en', fallbackValue: 'Ticket not found.' })
        )],
        ephemeral: true,
      });
      return;
    }

    const settings = await this.getTicketSettings(interaction.guild.id);
    const isAdmin = await this.hasAdminPermissions(interaction.member as GuildMember, settings);
    
    if (!isAdmin) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          'Only administrators can delete tickets.'
        )],
        ephemeral: true,
      });
      return;
    }

    // Show confirmation dialog
    const embed = createWarningEmbed(
      '⚠️ Delete Ticket',
      `Are you sure you want to **permanently delete** this ticket?\n\n` +
      `**Subject:** ${ticket.subject}\n` +
      `**Created by:** <@${ticket.user_id}>\n\n` +
      `⚠️ **This action cannot be undone!**`
    );

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_confirm_delete_${ticketId}`)
          .setLabel('Delete Forever')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setCustomId('ticket_cancel_delete')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true
    });
  }

  async handleConfirmAction(interaction: ButtonInteraction, parts: string[]): Promise<void> {
    const action = parts[2]; // confirm_delete, etc
    const ticketId = parts[3];

    if (action === 'delete') {
      await this.confirmTicketDeletion(interaction, ticketId);
    }
  }

  async handleCancelAction(interaction: ButtonInteraction): Promise<void> {
    const embed = createEmbed({
      title: '❌ Action Cancelled',
      description: 'The action has been cancelled.',
      color: colors.secondary
    });

    await interaction.update({
      embeds: [embed],
      components: []
    });
  }

  private async confirmTicketDeletion(interaction: ButtonInteraction, ticketId: string): Promise<void> {
    await interaction.deferUpdate();

    try {
      const ticket = await this.getTicket(ticketId);
      if (!ticket) {
        await interaction.editReply({
          embeds: [createErrorEmbed(
            i18n.t('common.error', { lng: 'en' }),
            i18n.t('tickets.not_found', { lng: 'en', fallbackValue: 'Ticket not found.' })
          )],
          components: []
        });
        return;
      }

      // Generate final transcript before deletion
      const channel = interaction.guild?.channels.cache.get(ticket.channel_id) as TextChannel;
      if (channel) {
        try {
          await this.generateTranscript(ticket, channel);
        } catch (error) {
          console.error('Error generating final transcript:', error);
        }
      }

      // Delete ticket and related data
      await db.query('DELETE FROM tickets WHERE id = $1', [ticketId]);

      // Log activity (this will be the last log entry)
      await this.logTicketActivity(ticketId, interaction.user.id, 'deleted', {
        deleted_by: interaction.user.tag
      });

      // Delete channel
      if (channel) {
        await channel.delete('Ticket deleted by administrator');
      }

      const embed = createSuccessEmbed(
        '🗑️ Ticket Deleted',
        'The ticket has been permanently deleted.'
      );

      await interaction.editReply({
        embeds: [embed],
        components: []
      });

      // Log to designated channel
      const settings = await this.getTicketSettings(interaction.guild!.id);
      if (settings.log_channel_id && settings.log_events.includes('deleted')) {
        await this.logTicketEvent(interaction.guild!, {
          type: 'deleted',
          ticket: { id: ticketId, subject: ticket.subject, channel_id: ticket.channel_id },
          user: interaction.user
        });
      }

    } catch (error) {
      console.error('Error deleting ticket:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          'Failed to delete ticket. Please try again.'
        )],
        components: []
      });
    }
  }

  // Rating system
  async handleRating(interaction: ButtonInteraction, ticketId: string, rating: string): Promise<void> {
    const ratingValue = parseInt(rating);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) return;

    const ticket = await this.getTicket(ticketId);
    if (!ticket || ticket.user_id !== interaction.user.id) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          'You can only rate your own tickets.'
        )],
        ephemeral: true,
      });
      return;
    }

    // Show feedback modal
    const modal = new ModalBuilder()
      .setCustomId(`ticket_feedback_${ticketId}_${rating}`)
      .setTitle(`Rate Your Experience (${rating}/5 stars)`);

    const feedbackInput = new TextInputBuilder()
      .setCustomId('feedback_text')
      .setLabel('Additional feedback (optional)')
      .setPlaceholder('Tell us about your experience...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(feedbackInput)
    );

    await interaction.showModal(modal);
  }

  async handleFeedbackModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.customId.startsWith('ticket_feedback_')) return;
    
    const parts = interaction.customId.split('_');
    const ticketId = parts[2];
    const rating = parseInt(parts[3]);
    const feedback = interaction.fields.getTextInputValue('feedback_text') || null;

    await interaction.deferReply({ ephemeral: true });

    try {
      await db.query(
        'UPDATE tickets SET satisfaction_rating = $1, satisfaction_feedback = $2 WHERE id = $3',
        [rating, feedback, ticketId]
      );

      // Log activity
      await this.logTicketActivity(ticketId, interaction.user.id, 'rated', {
        rating,
        feedback
      });

      const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
      const embed = createSuccessEmbed(
        '⭐ Thank you for your feedback!',
        `You rated this ticket: ${stars} (${rating}/5)\n\n` +
        (feedback ? `**Your feedback:** ${feedback}` : '')
      );

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error saving ticket rating:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          'Failed to save your rating. Please try again.'
        )]
      });
    }
  }

  // Helper methods (to be defined in main class)
  private async getTicket(ticketId: string): Promise<any> {
    const result = await db.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    return result.rows[0] || null;
  }

  private async getTicketCategory(categoryId: string): Promise<any> {
    const result = await db.query('SELECT * FROM ticket_categories WHERE id = $1', [categoryId]);
    return result.rows[0] || null;
  }

  private async getTicketSettings(guildId: string): Promise<any> {
    const result = await db.query('SELECT * FROM ticket_settings WHERE guild_id = $1', [guildId]);
    return result.rows[0] || {
      guild_id: guildId,
      enabled: true,
      max_tickets_per_user: 5,
      support_roles: [],
      admin_roles: [],
      log_events: []
    };
  }

  private async canManageTickets(member: GuildMember, guildId: string): Promise<boolean> {
    const settings = await this.getTicketSettings(guildId);
    return member.permissions.has(['ManageMessages', 'ManageChannels']) ||
           settings.support_roles.some((roleId: string) => member.roles.cache.has(roleId)) ||
           settings.admin_roles.some((roleId: string) => member.roles.cache.has(roleId));
  }

  private async hasAdminPermissions(member: GuildMember, settings: any): Promise<boolean> {
    return member.permissions.has('Administrator') ||
           settings.admin_roles.some((roleId: string) => member.roles.cache.has(roleId));
  }

  private async logTicketActivity(ticketId: string, userId: string, action: string, details: any = {}): Promise<void> {
    await db.query(
      'INSERT INTO ticket_activities (ticket_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [ticketId, userId, action, JSON.stringify(details)]
    );
  }

  private async logTicketEvent(guild: Guild, event: any): Promise<void> {
    // Implementation for logging events to designated channel
  }

  private async generateTranscript(ticket: any, channel: TextChannel): Promise<{ embed: EmbedBuilder, file?: AttachmentBuilder } | null> {
    // Implementation for transcript generation
    return null;
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}