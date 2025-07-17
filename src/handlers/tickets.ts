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
  GuildMember
} from 'discord.js';
import { db } from '../database/connection';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/helpers';
import { colors, emojis, limits } from '../utils/config';

export class TicketHandler {
  private static instance: TicketHandler;

  public static getInstance(): TicketHandler {
    if (!TicketHandler.instance) {
      TicketHandler.instance = new TicketHandler();
    }
    return TicketHandler.instance;
  }

  public async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.customId.startsWith('ticket_')) return;

    const action = interaction.customId.split('_')[1];
    const ticketId = interaction.customId.split('_')[2];

    switch (action) {
      case 'create':
        await this.handleTicketCreate(interaction, ticketId);
        break;
      case 'close':
        await this.handleTicketClose(interaction, ticketId);
        break;
      case 'claim':
        await this.handleTicketClaim(interaction, ticketId);
        break;
      case 'unclaim':
        await this.handleTicketUnclaim(interaction, ticketId);
        break;
    }
  }

  private async handleTicketCreate(interaction: ButtonInteraction, panelId: string): Promise<void> {
    if (!interaction.guild) return;

    const existingTickets = await db.query(
      'SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status = $3',
      [interaction.guild.id, interaction.user.id, 'open']
    );

    if (existingTickets.rows[0].count >= limits.maxTicketsPerUser) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'You have reached the maximum number of open tickets.')],
        ephemeral: true,
      });
      return;
    }

    const panel = await this.getTicketPanel(panelId);
    if (!panel) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Ticket panel not found.')],
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_${panelId}`)
      .setTitle('Create Ticket');

    const subjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel('Subject')
      .setPlaceholder('Brief description of your issue')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('ticket_description')
      .setLabel('Description')
      .setPlaceholder('Detailed description of your issue')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput);
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

    modal.addComponents(firstActionRow, secondActionRow);

    await interaction.showModal(modal);
  }

  public async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.customId.startsWith('ticket_modal_')) return;

    const panelId = interaction.customId.split('_')[2];
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const description = interaction.fields.getTextInputValue('ticket_description');

    await this.createTicket(interaction, panelId, subject, description);
  }

  private async createTicket(
    interaction: ModalSubmitInteraction,
    panelId: string,
    subject: string,
    description: string
  ): Promise<void> {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const panel = await this.getTicketPanel(panelId);
    if (!panel) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Ticket panel not found.')],
      });
      return;
    }

    const category = interaction.guild.channels.cache.get(panel.category) as CategoryChannel;
    if (!category) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Ticket category not found.')],
      });
      return;
    }

    try {
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category,
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
            ],
          },
          ...panel.support_roles.map((roleId: any) => ({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
            ],
          })),
        ],
      });

      const ticketResult = await db.query(
        `INSERT INTO tickets (guild_id, user_id, channel_id, panel_id, subject, priority)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [interaction.guild.id, interaction.user.id, ticketChannel.id, panelId, subject, 'medium']
      );

      const ticketId = ticketResult.rows[0].id;

      const embed = createEmbed({
        title: `${emojis.ticket} New Ticket`,
        description: `**Subject:** ${subject}\n**Description:** ${description}`,
        color: colors.primary,
        fields: [
          {
            name: 'Created by',
            value: `${interaction.user}`,
            inline: true,
          },
          {
            name: 'Priority',
            value: 'Medium',
            inline: true,
          },
          {
            name: 'Status',
            value: 'Open',
            inline: true,
          },
        ],
        timestamp: true,
      });

      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_claim_${ticketId}`)
            .setLabel('Claim')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👤'),
          new ButtonBuilder()
            .setCustomId(`ticket_close_${ticketId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
        );

      await ticketChannel.send({
        content: `${interaction.user} | ${panel.support_roles.map((r: any) => `<@&${r}>`).join(' ')}`,
        embeds: [embed],
        components: [buttons],
      });

      await interaction.editReply({
        embeds: [createSuccessEmbed('Ticket Created', `Your ticket has been created: ${ticketChannel}`)],
      });

    } catch (error) {
      console.error('Error creating ticket:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to create ticket. Please try again.')],
      });
    }
  }

  private async handleTicketClose(interaction: ButtonInteraction, ticketId: string): Promise<void> {
    if (!interaction.guild) return;

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Ticket not found.')],
        ephemeral: true,
      });
      return;
    }

    if (ticket.user_id !== interaction.user.id && !this.canManageTickets(interaction.member as GuildMember)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'You do not have permission to close this ticket.')],
        ephemeral: true,
      });
      return;
    }

    await db.query(
      'UPDATE tickets SET status = $1, closed_by = $2, closed_at = $3 WHERE id = $4',
      ['closed', interaction.user.id, new Date(), ticketId]
    );

    const embed = createEmbed({
      title: `${emojis.close} Ticket Closed`,
      description: `This ticket has been closed by ${interaction.user}`,
      color: colors.error,
      timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });

    const channel = interaction.guild.channels.cache.get(ticket.channel_id) as TextChannel;
    if (channel) {
      setTimeout(async () => {
        try {
          await channel.delete('Ticket closed');
        } catch (error) {
          console.error('Error deleting ticket channel:', error);
        }
      }, 5000);
    }
  }

  private async handleTicketClaim(interaction: ButtonInteraction, ticketId: string): Promise<void> {
    if (!interaction.guild) return;

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Ticket not found.')],
        ephemeral: true,
      });
      return;
    }

    if (!this.canManageTickets(interaction.member as GuildMember)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'You do not have permission to claim tickets.')],
        ephemeral: true,
      });
      return;
    }

    if (ticket.assigned_to) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'This ticket is already claimed.')],
        ephemeral: true,
      });
      return;
    }

    await db.query(
      'UPDATE tickets SET assigned_to = $1 WHERE id = $2',
      [interaction.user.id, ticketId]
    );

    const embed = createEmbed({
      title: `${emojis.success} Ticket Claimed`,
      description: `This ticket has been claimed by ${interaction.user}`,
      color: colors.success,
      timestamp: true,
    });

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_unclaim_${ticketId}`)
          .setLabel('Unclaim')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👥'),
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticketId}`)
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

    await interaction.update({ embeds: [embed], components: [buttons] });
  }

  private async handleTicketUnclaim(interaction: ButtonInteraction, ticketId: string): Promise<void> {
    if (!interaction.guild) return;

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'Ticket not found.')],
        ephemeral: true,
      });
      return;
    }

    if (ticket.assigned_to !== interaction.user.id && !this.canManageTickets(interaction.member as GuildMember)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'You do not have permission to unclaim this ticket.')],
        ephemeral: true,
      });
      return;
    }

    await db.query(
      'UPDATE tickets SET assigned_to = NULL WHERE id = $1',
      [ticketId]
    );

    const embed = createEmbed({
      title: `${emojis.ticket} Ticket Unclaimed`,
      description: `This ticket has been unclaimed by ${interaction.user}`,
      color: colors.warning,
      timestamp: true,
    });

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_claim_${ticketId}`)
          .setLabel('Claim')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👤'),
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticketId}`)
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

    await interaction.update({ embeds: [embed], components: [buttons] });
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

  private canManageTickets(member: GuildMember): boolean {
    return member.permissions.has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels]);
  }
}

export const ticketHandler = TicketHandler.getInstance();