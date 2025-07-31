import { 
  ButtonInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  ModalSubmitInteraction,
  ChannelType,
  PermissionFlagsBits,
  CategoryChannel,
  TextChannel,
  EmbedBuilder,
  GuildMember,
  SelectMenuBuilder,
  SelectMenuInteraction,
  StringSelectMenuBuilder,
  ComponentType,
  Message,
  ThreadChannel,
  AttachmentBuilder,
  Collection,
  Guild,
  User,
  Role
} from 'discord.js';
import { db } from '../database/connection';
import { createEmbed, createSuccessEmbed, createErrorEmbed, createWarningEmbed } from '../utils/helpers';
import { colors, emojis, limits } from '../utils/config';
import { i18n } from '../i18n';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

// Types for comprehensive ticket system
interface TicketCategory {
  id: string;
  guild_id: string;
  name: string;
  description?: string;
  emoji?: string;
  color: string;
  channel_id?: string;
  support_roles: string[];
  auto_close_hours: number;
  require_reason: boolean;
  max_tickets_per_user: number;
  priority_levels: string[];
  custom_fields: CustomField[];
}

interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
  max_length?: number;
}

interface TicketPanel {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id?: string;
  title: string;
  description?: string;
  color: string;
  embed_thumbnail?: string;
  embed_image?: string;
  buttons: PanelButton[];
  category_mapping: Record<string, string>;
  support_roles: string[];
  ping_roles: string[];
  enabled: boolean;
  created_by: string;
}

interface PanelButton {
  id: string;
  label: string;
  emoji?: string;
  style: ButtonStyle;
  category_id: string;
  description?: string;
}

interface Ticket {
  id: string;
  guild_id: string;
  user_id: string;
  channel_id: string;
  thread_id?: string;
  panel_id?: string;
  category_id?: string;
  subject: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'claimed' | 'pending' | 'closed';
  assigned_to?: string;
  claimed_at?: Date;
  custom_fields: Record<string, any>;
  tags: string[];
  created_at: Date;
  first_response_at?: Date;
  last_response_at?: Date;
  closed_at?: Date;
  closed_by?: string;
  close_reason?: string;
  response_time_minutes?: number;
  resolution_time_minutes?: number;
  satisfaction_rating?: number;
  satisfaction_feedback?: string;
  auto_close_warning_sent: boolean;
  last_activity_at: Date;
}

interface TicketSettings {
  guild_id: string;
  enabled: boolean;
  max_tickets_per_user: number;
  max_open_time_hours: number;
  auto_close_enabled: boolean;
  auto_close_time_hours: number;
  auto_close_warning_hours: number;
  transcript_channel_id?: string;
  auto_transcript: boolean;
  support_roles: string[];
  admin_roles: string[];
  ping_roles: string[];
  rate_limit_enabled: boolean;
  rate_limit_count: number;
  rate_limit_window_minutes: number;
  log_channel_id?: string;
  log_events: string[];
  welcome_message: string;
  close_message: string;
}

export class TicketHandler {
  private static instance: TicketHandler;
  private activeCollectors = new Map<string, any>();
  private rateLimitCache = new Map<string, number>();

  public static getInstance(): TicketHandler {
    if (!TicketHandler.instance) {
      TicketHandler.instance = new TicketHandler();
    }
    return TicketHandler.instance;
  }

  constructor() {
    // Start auto-close checker
    setInterval(() => this.checkAutoClose(), 30 * 60 * 1000); // Every 30 minutes
    
    // Start rate limit cleanup
    setInterval(() => this.cleanupRateLimits(), 5 * 60 * 1000); // Every 5 minutes
  }

  public async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.customId.startsWith('ticket_')) return;

    const parts = interaction.customId.split('_');
    const action = parts[1];
    const identifier = parts[2];

    try {
      switch (action) {
        case 'create':
          await this.handleTicketCreate(interaction, identifier);
          break;
        case 'close':
          await this.handleTicketClose(interaction, identifier);
          break;
        case 'claim':
          await this.handleTicketClaim(interaction, identifier);
          break;
        case 'unclaim':
          await this.handleTicketUnclaim(interaction, identifier);
          break;
        case 'priority':
          await this.handlePriorityChange(interaction, identifier);
          break;
        case 'adduser':
          await this.handleAddUser(interaction, identifier);
          break;
        case 'removeuser':
          await this.handleRemoveUser(interaction, identifier);
          break;
        case 'transcript':
          await this.handleTranscriptGeneration(interaction, identifier);
          break;
        case 'delete':
          await this.handleTicketDelete(interaction, identifier);
          break;
        case 'confirm':
          await this.handleConfirmAction(interaction, parts);
          break;
        case 'cancel':
          await this.handleCancelAction(interaction);
          break;
        case 'rate':
          await this.handleRating(interaction, identifier, parts[3]);
          break;
      }
    } catch (error) {
      console.error('Error handling ticket button interaction:', error);
      const errorEmbed = createErrorEmbed(
        i18n.t('common.error', { lng: 'en' }),
        i18n.t('tickets.interaction_error', { lng: 'en', fallbackValue: 'An error occurred while processing your request.' })
      );
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  public async handleSelectMenuInteraction(interaction: SelectMenuInteraction): Promise<void> {
    if (!interaction.customId.startsWith('ticket_')) return;

    const parts = interaction.customId.split('_');
    const action = parts[1];
    const identifier = parts[2];

    try {
      switch (action) {
        case 'category':
          await this.handleCategorySelection(interaction, identifier);
          break;
        case 'priority':
          await this.handlePrioritySelection(interaction, identifier);
          break;
        case 'adduser':
          await this.handleUserSelection(interaction, identifier);
          break;
      }
    } catch (error) {
      console.error('Error handling ticket select menu interaction:', error);
      const errorEmbed = createErrorEmbed(
        i18n.t('common.error', { lng: 'en' }),
        i18n.t('tickets.interaction_error', { lng: 'en', fallbackValue: 'An error occurred while processing your request.' })
      );
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  private async handleTicketCreate(interaction: ButtonInteraction, panelId: string): Promise<void> {
    if (!interaction.guild) return;

    // Rate limiting check
    if (await this.isRateLimited(interaction.guild.id, interaction.user.id, 'create')) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.rate_limited', { lng: 'en', fallbackValue: 'You are creating tickets too quickly. Please wait before creating another.' })
        )],
        ephemeral: true,
      });
      return;
    }

    const settings = await this.getTicketSettings(interaction.guild.id);
    if (!settings.enabled) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.system_disabled', { lng: 'en', fallbackValue: 'The ticket system is currently disabled.' })
        )],
        ephemeral: true,
      });
      return;
    }

    // Check existing tickets
    const existingTickets = await db.query(
      'SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status != $3',
      [interaction.guild.id, interaction.user.id, 'closed']
    );

    if (existingTickets.rows[0].count >= settings.max_tickets_per_user) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.max_tickets', { lng: 'en', count: settings.max_tickets_per_user, fallbackValue: `You have reached the maximum number of open tickets (${settings.max_tickets_per_user}).` })
        )],
        ephemeral: true,
      });
      return;
    }

    const panel = await this.getTicketPanel(panelId);
    if (!panel || !panel.enabled) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.panel_not_found', { lng: 'en', fallbackValue: 'Ticket panel not found or disabled.' })
        )],
        ephemeral: true,
      });
      return;
    }

    // If panel has multiple categories, show selection
    if (panel.buttons.length > 1) {
      await this.showCategorySelection(interaction, panel);
    } else if (panel.buttons.length === 1) {
      const categoryId = panel.buttons[0].category_id;
      await this.showTicketModal(interaction, panelId, categoryId);
    } else {
      // Fallback to legacy behavior
      await this.showTicketModal(interaction, panelId, null);
    }
  }

  private async showCategorySelection(interaction: ButtonInteraction, panel: TicketPanel): Promise<void> {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_category_${panel.id}`)
      .setPlaceholder('Select a ticket category')
      .setMinValues(1)
      .setMaxValues(1);

    for (const button of panel.buttons) {
      const category = await this.getTicketCategory(button.category_id);
      if (category) {
        selectMenu.addOptions({
          label: category.name,
          value: button.category_id,
          description: category.description || button.description,
          emoji: category.emoji || button.emoji
        });
      }
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = createEmbed({
      title: '🎫 Select Ticket Category',
      description: 'Please select the category that best describes your issue.',
      color: panel.color,
    });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }

  private async handleCategorySelection(interaction: SelectMenuInteraction, panelId: string): Promise<void> {
    const categoryId = interaction.values[0];
    await this.showTicketModal(interaction, panelId, categoryId);
  }

  private async showTicketModal(interaction: ButtonInteraction | SelectMenuInteraction, panelId: string, categoryId: string | null): Promise<void> {
    const category = categoryId ? await this.getTicketCategory(categoryId) : null;
    
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_${panelId}_${categoryId || 'default'}`)
      .setTitle(category ? `Create ${category.name} Ticket` : 'Create Ticket');

    const subjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel('Subject')
      .setPlaceholder('Brief description of your issue')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('ticket_description')
      .setLabel('Description')
      .setPlaceholder('Detailed description of your issue')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(category?.require_reason ?? true)
      .setMaxLength(2000);

    const rows = [
      new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput)
    ];

    // Add custom fields if category has them
    if (category?.custom_fields && category.custom_fields.length > 0) {
      for (let i = 0; i < Math.min(category.custom_fields.length, 3); i++) {
        const field = category.custom_fields[i];
        if (rows.length >= 5) break; // Discord limit
        
        const input = new TextInputBuilder()
          .setCustomId(`custom_field_${field.id}`)
          .setLabel(field.label)
          .setRequired(field.required)
          .setStyle(field.type === 'textarea' ? TextInputStyle.Paragraph : TextInputStyle.Short);
        
        if (field.max_length) {
          input.setMaxLength(field.max_length);
        }
        
        rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      }
    }

    modal.addComponents(rows);
    await interaction.showModal(modal);
  }

  public async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.customId.startsWith('ticket_modal_')) return;

    const parts = interaction.customId.split('_');
    const panelId = parts[2];
    const categoryId = parts[3] !== 'default' ? parts[3] : null;
    
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const description = interaction.fields.getTextInputValue('ticket_description');
    
    // Collect custom field values
    const customFields: Record<string, any> = {};
    
    if (categoryId) {
      const category = await this.getTicketCategory(categoryId);
      if (category?.custom_fields) {
        for (const field of category.custom_fields) {
          try {
            const value = interaction.fields.getTextInputValue(`custom_field_${field.id}`);
            customFields[field.id] = value;
          } catch {
            // Field not present in modal
          }
        }
      }
    }

    await this.createTicket(interaction, panelId, categoryId, subject, description, customFields);
  }

  private async createTicket(
    interaction: ModalSubmitInteraction,
    panelId: string,
    categoryId: string | null,
    subject: string,
    description: string,
    customFields: Record<string, any> = {}
  ): Promise<void> {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const panel = await this.getTicketPanel(panelId);
    if (!panel) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.panel_not_found', { lng: 'en', fallbackValue: 'Ticket panel not found.' })
        )],
      });
      return;
    }

    const category = categoryId ? await this.getTicketCategory(categoryId) : null;
    const settings = await this.getTicketSettings(interaction.guild.id);

    // Determine channel category for organization
    let channelCategory: CategoryChannel | null = null;
    if (category?.channel_id) {
      channelCategory = interaction.guild.channels.cache.get(category.channel_id) as CategoryChannel;
    }
    
    // Fallback to a default category or create in main channel list
    if (!channelCategory) {
      // Try to find a tickets category
      channelCategory = interaction.guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildCategory && 
        ch.name.toLowerCase().includes('ticket')
      ) as CategoryChannel;
    }

    try {
      // Generate unique ticket number
      const ticketCount = await db.query(
        'SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1',
        [interaction.guild.id]
      );
      const ticketNumber = (ticketCount.rows[0].count + 1).toString().padStart(4, '0');
      
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${ticketNumber}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        type: ChannelType.GuildText,
        parent: channelCategory,
        topic: `Ticket by ${interaction.user.tag} | ${subject}`,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          // Support roles from panel
          ...panel.support_roles.map((roleId: string) => ({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          })),
          // Additional support roles from settings
          ...settings.support_roles.map((roleId: string) => ({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          })),
        ],
      });

      // Insert ticket into database
      const defaultPriority = category?.priority_levels?.[0] || 'medium';
      const ticketResult = await db.query(
        `INSERT INTO tickets (guild_id, user_id, channel_id, panel_id, category_id, subject, description, priority, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          interaction.guild.id, 
          interaction.user.id, 
          ticketChannel.id, 
          panelId, 
          categoryId,
          subject, 
          description,
          defaultPriority,
          JSON.stringify(customFields)
        ]
      );

      const ticketId = ticketResult.rows[0].id;
      
      // Add rate limit entry
      await this.addRateLimit(interaction.guild.id, interaction.user.id, 'create');
      
      // Log activity
      await this.logTicketActivity(ticketId, interaction.user.id, 'created', {
        subject,
        category: category?.name,
        priority: defaultPriority
      });

      // Create ticket embed with enhanced information
      const priorityEmojis = {
        low: '🟢',
        medium: '🟡', 
        high: '🟠',
        urgent: '🔴'
      };
      
      const embed = createEmbed({
        title: `${category?.emoji || '🎫'} ${category?.name || 'New Ticket'} #${ticketNumber}`,
        description: `**Subject:** ${subject}\n**Description:** ${description}`,
        color: category?.color || panel.color,
        fields: [
          {
            name: '👤 Created by',
            value: `${interaction.user}`,
            inline: true,
          },
          {
            name: '📊 Priority',
            value: `${priorityEmojis[defaultPriority as keyof typeof priorityEmojis]} ${defaultPriority.charAt(0).toUpperCase() + defaultPriority.slice(1)}`,
            inline: true,
          },
          {
            name: '📋 Status',
            value: '🟢 Open',
            inline: true,
          },
          ...(category ? [{
            name: '📁 Category',
            value: category.name,
            inline: true,
          }] : []),
        ],
        footer: `Ticket ID: ${ticketId}`,
        timestamp: true,
      });
      
      // Add custom fields to embed if they exist
      if (Object.keys(customFields).length > 0 && category?.custom_fields) {
        const customFieldsText = category.custom_fields
          .filter(field => customFields[field.id])
          .map(field => `**${field.label}:** ${customFields[field.id]}`)
          .join('\n');
        
        if (customFieldsText) {
          embed.addFields({
            name: '📝 Additional Information',
            value: customFieldsText,
            inline: false
          });
        }
      }

      // Create comprehensive control buttons
      const controlButtons = this.createTicketControlButtons(ticketId, false);
      
      // Prepare ping content
      const pingRoles = [
        ...panel.ping_roles,
        ...settings.ping_roles,
        ...(category?.support_roles || [])
      ].filter((role, index, arr) => arr.indexOf(role) === index); // Remove duplicates
      
      const pingContent = pingRoles.length > 0 
        ? `${interaction.user} | ${pingRoles.map(roleId => `<@&${roleId}>`).join(' ')}`
        : `${interaction.user}`;

      // Send welcome message and ticket info
      await ticketChannel.send({
        content: pingContent,
        embeds: [embed],
        components: controlButtons,
      });
      
      // Send welcome message if configured
      if (settings.welcome_message) {
        const welcomeEmbed = createEmbed({
          title: '👋 Welcome!',
          description: settings.welcome_message,
          color: colors.success,
        });
        
        await ticketChannel.send({ embeds: [welcomeEmbed] });
      }

      await interaction.editReply({
        embeds: [createSuccessEmbed(
          i18n.t('tickets.created_title', { lng: 'en', fallbackValue: 'Ticket Created' }),
          i18n.t('tickets.created_description', { 
            lng: 'en', 
            channel: ticketChannel.toString(),
            number: ticketNumber,
            fallbackValue: `Your ticket #${ticketNumber} has been created: ${ticketChannel}` 
          })
        )],
      });
      
      // Update statistics
      await this.updateTicketStats(interaction.guild.id, 'created');
      
      // Log to designated channel if configured
      if (settings.log_channel_id && settings.log_events.includes('created')) {
        await this.logTicketEvent(interaction.guild, {
          type: 'created',
          ticket: { id: ticketId, subject, channel_id: ticketChannel.id },
          user: interaction.user,
          category: category?.name
        });
      }

    } catch (error) {
      console.error('Error creating ticket:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.creation_failed', { lng: 'en', fallbackValue: 'Failed to create ticket. Please try again later.' })
        )],
      });
    }
  }

  private async handleTicketClose(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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

    if (ticket.status === 'closed') {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.already_closed', { lng: 'en', fallbackValue: 'This ticket is already closed.' })
        )],
        ephemeral: true,
      });
      return;
    }

    const canClose = ticket.user_id === interaction.user.id || 
                     await this.canManageTickets(interaction.member as GuildMember, interaction.guild.id);
                     
    if (!canClose) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.no_permission_close', { lng: 'en', fallbackValue: 'You do not have permission to close this ticket.' })
        )],
        ephemeral: true,
      });
      return;
    }

    // Show close confirmation with reason input
    const modal = new ModalBuilder()
      .setCustomId(`ticket_close_modal_${ticketId}`)
      .setTitle('Close Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('Reason for closing (optional)')
      .setPlaceholder('Provide a reason for closing this ticket...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const ratingInput = new TextInputBuilder()
      .setCustomId('satisfaction_rating')
      .setLabel('Rate your experience (1-5, optional)')
      .setPlaceholder('1 = Poor, 5 = Excellent')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMinLength(1)
      .setMaxLength(1);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(ratingInput)
    );

    await interaction.showModal(modal);
  }

  public async handleCloseModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.customId.startsWith('ticket_close_modal_')) return;
    
    const ticketId = interaction.customId.split('_')[3];
    const closeReason = interaction.fields.getTextInputValue('close_reason') || null;
    const ratingStr = interaction.fields.getTextInputValue('satisfaction_rating');
    
    let satisfactionRating: number | null = null;
    if (ratingStr) {
      const rating = parseInt(ratingStr);
      if (rating >= 1 && rating <= 5) {
        satisfactionRating = rating;
      }
    }

    await this.closeTicket(interaction, ticketId, closeReason, satisfactionRating);
  }

  private async closeTicket(
    interaction: ModalSubmitInteraction, 
    ticketId: string, 
    closeReason: string | null = null,
    satisfactionRating: number | null = null
  ): Promise<void> {
    if (!interaction.guild) return;

    await interaction.deferReply();
    
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

    const settings = await this.getTicketSettings(interaction.guild.id);
    const channel = interaction.guild.channels.cache.get(ticket.channel_id) as TextChannel;

    try {
      // Calculate resolution time
      const createdAt = new Date(ticket.created_at);
      const closedAt = new Date();
      const resolutionTimeMinutes = Math.floor((closedAt.getTime() - createdAt.getTime()) / (1000 * 60));

      // Update ticket in database
      await db.query(
        `UPDATE tickets SET 
         status = $1, closed_by = $2, closed_at = $3, close_reason = $4, 
         satisfaction_rating = $5, resolution_time_minutes = $6
         WHERE id = $7`,
        ['closed', interaction.user.id, closedAt, closeReason, satisfactionRating, resolutionTimeMinutes, ticketId]
      );

      // Log activity
      await this.logTicketActivity(ticketId, interaction.user.id, 'closed', {
        reason: closeReason,
        rating: satisfactionRating,
        resolution_time_minutes: resolutionTimeMinutes
      });

      // Generate transcript if auto-transcript is enabled
      let transcriptEmbed = null;
      if (settings.auto_transcript && channel) {
        try {
          const transcript = await this.generateTranscript(ticket, channel);
          if (transcript && settings.transcript_channel_id) {
            const transcriptChannel = interaction.guild.channels.cache.get(settings.transcript_channel_id) as TextChannel;
            if (transcriptChannel) {
              const transcriptMessage = await transcriptChannel.send({
                embeds: [transcript.embed],
                files: transcript.file ? [transcript.file] : []
              });
              
              // Update transcript record with archive info
              await db.query(
                'UPDATE ticket_transcripts SET archive_channel_id = $1, archive_message_id = $2 WHERE ticket_id = $3',
                [transcriptChannel.id, transcriptMessage.id, ticketId]
              );
              
              transcriptEmbed = createEmbed({
                title: '📄 Transcript Generated',
                description: `Ticket transcript has been saved to ${transcriptChannel}`,
                color: colors.primary
              });
            }
          }
        } catch (error) {
          console.error('Error generating transcript:', error);
        }
      }

      // Create close embed
      const embed = createEmbed({
        title: `🔒 Ticket Closed`,
        description: `This ticket has been closed by ${interaction.user}`,
        color: colors.error,
        fields: [
          ...(closeReason ? [{
            name: '📝 Reason',
            value: closeReason,
            inline: false
          }] : []),
          ...(satisfactionRating ? [{
            name: '⭐ Rating',
            value: `${satisfactionRating}/5 stars`,
            inline: true
          }] : []),
          {
            name: '⏱️ Resolution Time',
            value: this.formatDuration(resolutionTimeMinutes * 60),
            inline: true
          }
        ],
        footer: settings.close_message,
        timestamp: true,
      });

      const embeds = [embed];
      if (transcriptEmbed) embeds.push(transcriptEmbed);

      await interaction.editReply({ embeds });

      // Update channel permissions to read-only
      if (channel) {
        try {
          await channel.permissionOverwrites.edit(ticket.user_id, {
            SendMessages: false,
            AddReactions: false
          });
          
          // Set channel name to indicate closure
          await channel.setName(`closed-${channel.name.replace(/^(ticket-|closed-)/, '')}`);
          
          // Delete channel after delay
          setTimeout(async () => {
            try {
              await channel.delete('Ticket closed - auto cleanup');
            } catch (error) {
              console.error('Error deleting closed ticket channel:', error);
            }
          }, 30000); // 30 seconds delay
          
        } catch (error) {
          console.error('Error updating channel permissions:', error);
        }
      }

      // Update statistics
      await this.updateTicketStats(interaction.guild.id, 'closed');
      
      // Log to designated channel
      if (settings.log_channel_id && settings.log_events.includes('closed')) {
        await this.logTicketEvent(interaction.guild, {
          type: 'closed',
          ticket: { id: ticketId, subject: ticket.subject, channel_id: ticket.channel_id },
          user: interaction.user,
          details: { reason: closeReason, rating: satisfactionRating }
        });
      }

    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.close_failed', { lng: 'en', fallbackValue: 'Failed to close ticket. Please try again.' })
        )]
      });
    }
  }

  private async handleTicketClaim(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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
          i18n.t('tickets.no_permission_claim', { lng: 'en', fallbackValue: 'You do not have permission to claim tickets.' })
        )],
        ephemeral: true,
      });
      return;
    }

    if (ticket.assigned_to) {
      const assignedUser = await interaction.client.users.fetch(ticket.assigned_to).catch(() => null);
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.already_claimed', { 
            lng: 'en', 
            user: assignedUser?.tag || 'Unknown User',
            fallbackValue: `This ticket is already claimed by ${assignedUser?.tag || 'Unknown User'}.` 
          })
        )],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      // Calculate first response time if this is the first claim
      let firstResponseTime = null;
      if (!ticket.first_response_at) {
        const createdAt = new Date(ticket.created_at);
        const claimedAt = new Date();
        firstResponseTime = Math.floor((claimedAt.getTime() - createdAt.getTime()) / (1000 * 60));
      }

      await db.query(
        `UPDATE tickets SET 
         assigned_to = $1, claimed_at = $2, status = $3, first_response_at = COALESCE(first_response_at, $4)
         WHERE id = $5`,
        [interaction.user.id, new Date(), 'claimed', firstResponseTime ? new Date() : null, ticketId]
      );

      // Log activity
      await this.logTicketActivity(ticketId, interaction.user.id, 'claimed', {
        first_response_time_minutes: firstResponseTime
      });

      const embed = createEmbed({
        title: `👤 Ticket Claimed`,
        description: `This ticket has been claimed by ${interaction.user}\n\n**Status:** 🟡 Claimed`,
        color: colors.warning,
        fields: [
          {
            name: '🕰️ Claimed At',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          },
          ...(firstResponseTime ? [{
            name: '⏱️ First Response Time',
            value: this.formatDuration(firstResponseTime * 60),
            inline: true
          }] : [])
        ],
        timestamp: true,
      });

      const components = this.createTicketControlButtons(ticketId, true, interaction.user.id);

      await interaction.editReply({ embeds: [embed], components });

      // Update statistics
      await this.updateTicketStats(interaction.guild.id, 'claimed');
      
      // Log to designated channel
      const settings = await this.getTicketSettings(interaction.guild.id);
      if (settings.log_channel_id && settings.log_events.includes('claimed')) {
        await this.logTicketEvent(interaction.guild, {
          type: 'claimed',
          ticket: { id: ticketId, subject: ticket.subject, channel_id: ticket.channel_id },
          user: interaction.user
        });
      }

    } catch (error) {
      console.error('Error claiming ticket:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.claim_failed', { lng: 'en', fallbackValue: 'Failed to claim ticket. Please try again.' })
        )]
      });
    }
  }

  private async handleTicketUnclaim(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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

    const canUnclaim = ticket.assigned_to === interaction.user.id || 
                       await this.canManageTickets(interaction.member as GuildMember, interaction.guild.id);
                       
    if (!canUnclaim) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.no_permission_unclaim', { lng: 'en', fallbackValue: 'You do not have permission to unclaim this ticket.' })
        )],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      await db.query(
        'UPDATE tickets SET assigned_to = NULL, status = $1 WHERE id = $2',
        ['open', ticketId]
      );

      // Log activity
      await this.logTicketActivity(ticketId, interaction.user.id, 'unclaimed');

      const embed = createEmbed({
        title: `👥 Ticket Unclaimed`,
        description: `This ticket has been unclaimed by ${interaction.user}\n\n**Status:** 🟢 Open`,
        color: colors.primary,
        timestamp: true,
      });

      const components = this.createTicketControlButtons(ticketId, false);

      await interaction.editReply({ embeds: [embed], components });
      
      // Log to designated channel
      const settings = await this.getTicketSettings(interaction.guild.id);
      if (settings.log_channel_id && settings.log_events.includes('unclaimed')) {
        await this.logTicketEvent(interaction.guild, {
          type: 'unclaimed',
          ticket: { id: ticketId, subject: ticket.subject, channel_id: ticket.channel_id },
          user: interaction.user
        });
      }

    } catch (error) {
      console.error('Error unclaiming ticket:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          i18n.t('common.error', { lng: 'en' }),
          i18n.t('tickets.unclaim_failed', { lng: 'en', fallbackValue: 'Failed to unclaim ticket. Please try again.' })
        )]
      });
    }
  }

  public async createTicketPanel(
    guildId: string,
    channelId: string,
    title: string,
    description: string,
    category: string,
    supportRoles: string[],
    color: string = colors.primary
  ): Promise<string | null> {
    try {
      const embed = createEmbed({
        title: `${emojis.ticket} ${title}`,
        description: description,
        color: color,
        footer: 'Click the button below to create a ticket',
      });

      const guild = global.client?.guilds.cache.get(guildId);
      if (!guild) return null;

      const channel = guild.channels.cache.get(channelId) as TextChannel;
      if (!channel) return null;

      // First create the message
      const message = await channel.send({
        embeds: [embed],
        components: [], // Empty components initially
      });

      // Then create the panel record with the message ID
      const result = await db.query(
        `INSERT INTO ticket_panels (guild_id, channel_id, message_id, title, description, category, support_roles, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [guildId, channelId, message.id, title, description, category, supportRoles, color]
      );

      const panelId = result.rows[0].id;

      // Now create the button with the panel ID
      const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_create_${panelId}`)
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
        );

      // Update the message with the button
      await message.edit({
        embeds: [embed],
        components: [button],
      });

      return panelId;
    } catch (error) {
      console.error('Error creating ticket panel:', error);
      return null;
    }
  }

  public async getTicketPanel(panelId: string): Promise<any | null> {
    const result = await db.query(
      'SELECT * FROM ticket_panels WHERE id = $1',
      [panelId]
    );

    return result.rows[0] || null;
  }

  public async getTicket(ticketId: string): Promise<any | null> {
    const result = await db.query(
      'SELECT * FROM tickets WHERE id = $1',
      [ticketId]
    );

    return result.rows[0] || null;
  }

  public async getTicketByChannelId(channelId: string): Promise<any | null> {
    const result = await db.query(
      'SELECT * FROM tickets WHERE channel_id = $1',
      [channelId]
    );

    return result.rows[0] || null;
  }

  public async getTicketPanels(guildId: string): Promise<any[]> {
    const result = await db.query(
      'SELECT * FROM ticket_panels WHERE guild_id = $1',
      [guildId]
    );

    return result.rows;
  }

  public async getTickets(guildId: string, status?: string): Promise<any[]> {
    let query = 'SELECT * FROM tickets WHERE guild_id = $1';
    const params: any[] = [guildId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  public async deleteTicketPanel(panelId: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM ticket_panels WHERE id = $1',
      [panelId]
    );

    return result.rowCount > 0;
  }

  private async canManageTickets(member: GuildMember, guildId: string): Promise<boolean> {
    const settings = await this.getTicketSettings(guildId);
    
    // Check basic Discord permissions
    if (member.permissions.has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels])) {
      return true;
    }
    
    // Check support roles
    if (settings.support_roles.some(roleId => member.roles.cache.has(roleId))) {
      return true;
    }
    
    // Check admin roles
    if (settings.admin_roles.some(roleId => member.roles.cache.has(roleId))) {
      return true;
    }
    
    return false;
  }

  // Rate limiting methods
  private async isRateLimited(guildId: string, userId: string, action: string): Promise<boolean> {
    const settings = await this.getTicketSettings(guildId);
    if (!settings.rate_limit_enabled) return false;

    const windowStart = new Date(Date.now() - settings.rate_limit_window_minutes * 60 * 1000);
    
    const result = await db.query(
      'SELECT count FROM ticket_rate_limits WHERE guild_id = $1 AND user_id = $2 AND action = $3 AND window_start >= $4',
      [guildId, userId, action, windowStart]
    );

    if (result.rows.length === 0) return false;
    
    return result.rows[0].count >= settings.rate_limit_count;
  }

  private async addRateLimit(guildId: string, userId: string, action: string): Promise<void> {
    const settings = await this.getTicketSettings(guildId);
    if (!settings.rate_limit_enabled) return;

    const windowStart = new Date(Date.now() - settings.rate_limit_window_minutes * 60 * 1000);
    const expiresAt = new Date(Date.now() + settings.rate_limit_window_minutes * 60 * 1000);

    await db.query(
      `INSERT INTO ticket_rate_limits (guild_id, user_id, action, count, expires_at)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (guild_id, user_id, action)
       DO UPDATE SET 
         count = CASE 
           WHEN ticket_rate_limits.window_start < $5 THEN 1
           ELSE ticket_rate_limits.count + 1
         END,
         window_start = CASE
           WHEN ticket_rate_limits.window_start < $5 THEN CURRENT_TIMESTAMP
           ELSE ticket_rate_limits.window_start
         END,
         expires_at = $4`,
      [guildId, userId, action, expiresAt, windowStart]
    );
  }

  private async cleanupRateLimits(): Promise<void> {
    await db.query('DELETE FROM ticket_rate_limits WHERE expires_at < CURRENT_TIMESTAMP');
  }

  // Activity logging
  private async logTicketActivity(ticketId: string, userId: string, action: string, details: any = {}): Promise<void> {
    await db.query(
      'INSERT INTO ticket_activities (ticket_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [ticketId, userId, action, JSON.stringify(details)]
    );
  }

  // Statistics updates
  private async updateTicketStats(guildId: string, action: 'created' | 'closed' | 'claimed'): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const updateField = action === 'created' ? 'tickets_created' : 
                       action === 'closed' ? 'tickets_closed' : 'tickets_claimed';
    
    await db.query(
      `INSERT INTO ticket_stats (guild_id, date, ${updateField})
       VALUES ($1, $2, 1)
       ON CONFLICT (guild_id, date)
       DO UPDATE SET ${updateField} = ticket_stats.${updateField} + 1`,
      [guildId, today]
    );
  }

  // Event logging to channels
  private async logTicketEvent(guild: Guild, event: {
    type: string;
    ticket: { id: string; subject: string; channel_id: string };
    user: User;
    category?: string;
    details?: any;
  }): Promise<void> {
    const settings = await this.getTicketSettings(guild.id);
    if (!settings.log_channel_id) return;

    const logChannel = guild.channels.cache.get(settings.log_channel_id) as TextChannel;
    if (!logChannel) return;

    const eventEmojis = {
      created: '🎫',
      claimed: '👤',
      unclaimed: '👥',
      closed: '🔒',
      priority_changed: '📊',
      deleted: '🗑️'
    };

    const embed = createEmbed({
      title: `${eventEmojis[event.type as keyof typeof eventEmojis] || '📋'} Ticket ${event.type.charAt(0).toUpperCase() + event.type.slice(1).replace('_', ' ')}`,
      description: `**Ticket:** ${event.ticket.subject}\n**User:** ${event.user}\n**Channel:** <#${event.ticket.channel_id}>`,
      color: event.type === 'created' ? colors.success : 
             event.type === 'closed' ? colors.error : 
             event.type === 'claimed' ? colors.warning : colors.primary,
      fields: [
        ...(event.category ? [{ name: 'Category', value: event.category, inline: true }] : []),
        ...(event.details ? Object.entries(event.details).map(([key, value]) => ({
          name: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: String(value),
          inline: true
        })) : [])
      ],
      footer: `Ticket ID: ${event.ticket.id}`,
      timestamp: true
    });

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending ticket log:', error);
    }
  }

  // Format duration helper
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  // Auto-close functionality
  private async checkAutoClose(): Promise<void> {
    try {
      // Get all guilds with auto-close enabled
      const guildsResult = await db.query(
        'SELECT guild_id, auto_close_time_hours, auto_close_warning_hours FROM ticket_settings WHERE auto_close_enabled = true'
      );

      for (const guildSettings of guildsResult.rows) {
        const warningTime = new Date(Date.now() - guildSettings.auto_close_warning_hours * 60 * 60 * 1000);
        const closeTime = new Date(Date.now() - guildSettings.auto_close_time_hours * 60 * 60 * 1000);

        // Send warnings for tickets that will be auto-closed soon
        const warningTickets = await db.query(
          `SELECT * FROM tickets 
           WHERE guild_id = $1 AND status != 'closed' 
           AND last_activity_at <= $2 AND auto_close_warning_sent = false`,
          [guildSettings.guild_id, warningTime]
        );

        for (const ticket of warningTickets.rows) {
          await this.sendAutoCloseWarning(ticket);
        }

        // Auto-close tickets that have exceeded the time limit
        const expiredTickets = await db.query(
          `SELECT * FROM tickets 
           WHERE guild_id = $1 AND status != 'closed' 
           AND last_activity_at <= $2`,
          [guildSettings.guild_id, closeTime]
        );

        for (const ticket of expiredTickets.rows) {
          await this.autoCloseTicket(ticket);
        }
      }
    } catch (error) {
      console.error('Error in auto-close check:', error);
    }
  }

  private async sendAutoCloseWarning(ticket: any): Promise<void> {
    try {
      const guild = global.client?.guilds.cache.get(ticket.guild_id);
      if (!guild) return;

      const channel = guild.channels.cache.get(ticket.channel_id) as TextChannel;
      if (!channel) return;

      const settings = await this.getTicketSettings(ticket.guild_id);
      const hoursUntilClose = settings.auto_close_time_hours - settings.auto_close_warning_hours;

      const embed = createWarningEmbed(
        '⚠️ Auto-Close Warning',
        `This ticket will be automatically closed in **${hoursUntilClose} hours** due to inactivity.\n\n` +
        'Send a message in this channel to prevent auto-closure.'
      );

      await channel.send({ embeds: [embed] });

      // Mark warning as sent
      await db.query(
        'UPDATE tickets SET auto_close_warning_sent = true WHERE id = $1',
        [ticket.id]
      );

    } catch (error) {
      console.error('Error sending auto-close warning:', error);
    }
  }

  private async autoCloseTicket(ticket: any): Promise<void> {
    try {
      const guild = global.client?.guilds.cache.get(ticket.guild_id);
      if (!guild) return;

      const channel = guild.channels.cache.get(ticket.channel_id) as TextChannel;
      const settings = await this.getTicketSettings(ticket.guild_id);

      // Calculate resolution time
      const createdAt = new Date(ticket.created_at);
      const closedAt = new Date();
      const resolutionTimeMinutes = Math.floor((closedAt.getTime() - createdAt.getTime()) / (1000 * 60));

      // Update ticket status
      await db.query(
        `UPDATE tickets SET 
         status = 'closed', closed_by = 'system', closed_at = $1, 
         close_reason = 'Auto-closed due to inactivity', resolution_time_minutes = $2
         WHERE id = $3`,
        [closedAt, resolutionTimeMinutes, ticket.id]
      );

      // Log activity
      await this.logTicketActivity(ticket.id, 'system', 'auto_closed', {
        reason: 'Auto-closed due to inactivity',
        resolution_time_minutes: resolutionTimeMinutes
      });

      // Generate transcript if enabled
      if (settings.auto_transcript && channel) {
        try {
          await this.generateTranscript(ticket, channel);
        } catch (error) {
          console.error('Error generating auto-close transcript:', error);
        }
      }

      // Send auto-close message
      if (channel) {
        const embed = createEmbed({
          title: '🤖 Ticket Auto-Closed',
          description: 'This ticket has been automatically closed due to inactivity.',
          color: colors.warning,
          fields: [
            {
              name: '⏱️ Resolution Time',
              value: this.formatDuration(resolutionTimeMinutes * 60),
              inline: true
            }
          ],
          footer: settings.close_message,
          timestamp: true,
        });

        await channel.send({ embeds: [embed] });

        // Delete channel after delay
        setTimeout(async () => {
          try {
            await channel.delete('Ticket auto-closed - cleanup');
          } catch (error) {
            console.error('Error deleting auto-closed ticket channel:', error);
          }
        }, 30000);
      }

      // Update statistics
      await this.updateTicketStats(ticket.guild_id, 'closed');

      // Log event
      if (settings.log_channel_id && settings.log_events.includes('closed')) {
        await this.logTicketEvent(guild, {
          type: 'closed',
          ticket: { id: ticket.id, subject: ticket.subject, channel_id: ticket.channel_id },
          user: { id: 'system', tag: 'System' } as User,
          details: { reason: 'Auto-closed due to inactivity' }
        });
      }

    } catch (error) {
      console.error('Error auto-closing ticket:', error);
    }
  }

  // Transcript generation method (basic implementation)
  private async generateTranscript(ticket: Ticket, channel: TextChannel): Promise<{ embed: EmbedBuilder, file?: AttachmentBuilder } | null> {
    try {
      // Fetch messages from the channel
      const messages: Message[] = [];
      let lastMessageId: string | undefined;
      
      // Fetch all messages in batches
      while (true) {
        const batch = await channel.messages.fetch({ 
          limit: 100, 
          before: lastMessageId 
        });
        
        if (batch.size === 0) break;
        
        messages.push(...batch.values());
        lastMessageId = batch.last()?.id;
      }

      // Sort messages chronologically
      messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      // Generate HTML transcript
      const htmlContent = this.generateHTMLTranscript(ticket, messages, channel);
      
      // Save transcript to database
      const transcriptResult = await db.query(
        `INSERT INTO ticket_transcripts 
         (ticket_id, guild_id, channel_id, generated_by, html_content, message_count, attachment_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          ticket.id,
          ticket.guild_id,
          ticket.channel_id,
          'system',
          htmlContent,
          messages.length,
          messages.reduce((count, msg) => count + msg.attachments.size, 0)
        ]
      );

      // Create transcript embed
      const embed = new EmbedBuilder()
        .setTitle('📄 Ticket Transcript')
        .setDescription(`**Ticket:** ${ticket.subject}\n**Messages:** ${messages.length}\n**Generated:** <t:${Math.floor(Date.now() / 1000)}:F>`)
        .setColor(colors.primary)
        .addFields(
          { name: 'Ticket ID', value: ticket.id, inline: true },
          { name: 'Created by', value: `<@${ticket.user_id}>`, inline: true },
          { name: 'Status', value: ticket.status, inline: true }
        )
        .setTimestamp();

      // Create file attachment if transcript is not too large
      let file: AttachmentBuilder | undefined;
      if (htmlContent.length < 25 * 1024 * 1024) { // 25MB Discord limit
        file = new AttachmentBuilder(
          Buffer.from(htmlContent, 'utf8'),
          { name: `ticket-${ticket.id}-transcript.html` }
        );
      }

      return { embed, file };

    } catch (error) {
      console.error('Error generating transcript:', error);
      return null;
    }
  }

  private generateHTMLTranscript(ticket: Ticket, messages: Message[], channel: TextChannel): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Ticket Transcript - ${ticket.subject}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #36393f; color: #dcddde; margin: 0; padding: 20px; }
        .header { background: #2f3136; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .message { background: #40444b; margin: 8px 0; padding: 12px; border-radius: 6px; border-left: 4px solid #7289da; }
        .author { font-weight: bold; color: #ffffff; margin-bottom: 4px; }
        .timestamp { color: #72767d; font-size: 12px; }
        .content { margin: 8px 0; line-height: 1.4; }
        .attachment { background: #2f3136; padding: 8px; margin: 4px 0; border-radius: 4px; }
        .embed { background: #2f3136; border-left: 4px solid #7289da; padding: 12px; margin: 8px 0; }
        .bot { border-left-color: #5865f2; }
        .system { border-left-color: #faa61a; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📄 Ticket Transcript</h1>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <p><strong>Channel:</strong> #${channel.name}</p>
        <p><strong>Created:</strong> ${new Date(ticket.created_at).toLocaleString()}</p>
        <p><strong>Messages:</strong> ${messages.length}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>
`;

    let messagesHtml = '';
    for (const message of messages) {
      const isBot = message.author.bot;
      const isSystem = message.author.system;
      const cssClass = isBot ? 'bot' : isSystem ? 'system' : '';
      
      messagesHtml += `
    <div class="message ${cssClass}">
        <div class="author">${message.author.tag} ${isBot ? '🤖' : ''}</div>
        <div class="timestamp">${message.createdAt.toLocaleString()}</div>
        <div class="content">${this.escapeHtml(message.content)}</div>
`;

      // Add attachments
      if (message.attachments.size > 0) {
        for (const attachment of message.attachments.values()) {
          messagesHtml += `        <div class="attachment">📎 <a href="${attachment.url}" target="_blank">${attachment.name}</a> (${this.formatFileSize(attachment.size)})</div>\n`;
        }
      }

      // Add embeds
      if (message.embeds.length > 0) {
        for (const embed of message.embeds) {
          messagesHtml += `        <div class="embed">\n`;
          if (embed.title) messagesHtml += `            <div><strong>${this.escapeHtml(embed.title)}</strong></div>\n`;
          if (embed.description) messagesHtml += `            <div>${this.escapeHtml(embed.description)}</div>\n`;
          messagesHtml += `        </div>\n`;
        }
      }

      messagesHtml += `    </div>\n`;
    }

    return html + messagesHtml + `
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Priority management
  private async handlePriorityChange(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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

  private async handlePrioritySelection(interaction: SelectMenuInteraction, ticketId: string): Promise<void> {
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
  private async handleAddUser(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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

  private async handleRemoveUser(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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

  private async handleTranscriptGeneration(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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

  private async handleTicketDelete(interaction: ButtonInteraction, ticketId: string): Promise<void> {
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
    const member = interaction.member as GuildMember;
    const isAdmin = member.permissions.has('Administrator') ||
                   settings.admin_roles.some(roleId => member.roles.cache.has(roleId));
    
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

  private async handleConfirmAction(interaction: ButtonInteraction, parts: string[]): Promise<void> {
    const action = parts[2];
    const ticketId = parts[3];

    if (action === 'delete') {
      await this.confirmTicketDeletion(interaction, ticketId);
    }
  }

  private async handleCancelAction(interaction: ButtonInteraction): Promise<void> {
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

      const channel = interaction.guild?.channels.cache.get(ticket.channel_id) as TextChannel;
      if (channel) {
        try {
          await this.generateTranscript(ticket, channel);
        } catch (error) {
          console.error('Error generating final transcript:', error);
        }
      }

      await db.query('DELETE FROM tickets WHERE id = $1', [ticketId]);
      await this.logTicketActivity(ticketId, interaction.user.id, 'deleted', {
        deleted_by: interaction.user.tag
      });

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

  private async handleRating(interaction: ButtonInteraction, ticketId: string, rating: string): Promise<void> {
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

  // Additional modal handlers
  public async handleAdditionalModals(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId.startsWith('ticket_close_modal_')) {
      await this.handleCloseModal(interaction);
    } else if (interaction.customId.startsWith('ticket_adduser_modal_')) {
      await this.handleAddUserModal(interaction);
    } else if (interaction.customId.startsWith('ticket_feedback_')) {
      await this.handleFeedbackModal(interaction);
    }
  }

  private async handleCloseModal(interaction: ModalSubmitInteraction): Promise<void> {
    const ticketId = interaction.customId.split('_')[3];
    const closeReason = interaction.fields.getTextInputValue('close_reason') || null;
    const ratingStr = interaction.fields.getTextInputValue('satisfaction_rating');
    
    let satisfactionRating: number | null = null;
    if (ratingStr) {
      const rating = parseInt(ratingStr);
      if (rating >= 1 && rating <= 5) {
        satisfactionRating = rating;
      }
    }

    await this.closeTicket(interaction, ticketId, closeReason, satisfactionRating);
  }

  private async handleAddUserModal(interaction: ModalSubmitInteraction): Promise<void> {
    const ticketId = interaction.customId.split('_')[3];
    const userInput = interaction.fields.getTextInputValue('user_input');
    
    await interaction.deferReply({ ephemeral: true });

    try {
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

      await db.query(
        'INSERT INTO ticket_participants (ticket_id, user_id, added_by) VALUES ($1, $2, $3)',
        [ticketId, userId, interaction.user.id]
      );

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

      await this.logTicketActivity(ticketId, interaction.user.id, 'user_added', {
        added_user_id: userId,
        added_user_tag: user.tag
      });

      const embed = createSuccessEmbed(
        '✅ User Added',
        `${user} has been added to this ticket.`
      );

      await interaction.editReply({ embeds: [embed] });

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

  private async handleFeedbackModal(interaction: ModalSubmitInteraction): Promise<void> {
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
}

export const ticketHandler = TicketHandler.getInstance();