import { 
  TextChannel, 
  Guild, 
  PermissionFlagsBits, 
  ChannelType, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CategoryChannel,
  OverwriteType,
  GuildMember,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction
} from 'discord.js';
import { TicketRepository, TicketPanelData } from '../repositories/ticketRepository';
import { t } from '../i18n';
import { GuildService } from './guildService';

export class TicketService {
  private ticketRepository: TicketRepository;
  private guildService: GuildService;

  constructor() {
    this.ticketRepository = new TicketRepository();
    this.guildService = new GuildService();
  }

  // Panel management
  async createPanel(guild: Guild, data: TicketPanelData) {
    // Validate panel ID is unique for guild
    const existing = await this.ticketRepository.getPanel(data.panelId, guild.id);
    if (existing) {
      throw new Error('Panel ID already exists');
    }

    return await this.ticketRepository.createPanel({
      ...data,
      guildId: guild.id,
    });
  }

  async loadPanel(guild: Guild, panelId: string, channel: TextChannel, _locale: string) {
    const panel = await this.ticketRepository.getPanel(panelId, guild.id);
    if (!panel) {
      throw new Error('Panel not found');
    }

    if (!panel.isActive) {
      throw new Error('Panel is not active');
    }

    // Create panel embed
    const embed = new EmbedBuilder()
      .setTitle(panel.title)
      .setDescription(panel.description)
      .setColor(0x5865F2);

    if (panel.imageUrl) {
      embed.setImage(panel.imageUrl);
    }

    if (panel.footer) {
      embed.setFooter({ text: panel.footer });
    }

    // Create button
    const button = new ButtonBuilder()
      .setCustomId(`ticket_create:${panel.id}`)
      .setLabel(panel.buttonLabel)
      .setStyle(panel.buttonStyle as ButtonStyle);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    // Send panel
    const message = await channel.send({
      embeds: [embed],
      components: [row],
    });

    // Update panel with message info
    await this.ticketRepository.setPanelMessage(panelId, guild.id, message.id, channel.id);

    return message;
  }

  async deletePanel(guild: Guild, panelId: string) {
    const panel = await this.ticketRepository.getPanel(panelId, guild.id);
    if (!panel) {
      throw new Error('Panel not found');
    }

    // Delete panel message if exists
    if (panel.messageId && panel.channelId) {
      try {
        const channel = await guild.channels.fetch(panel.channelId) as TextChannel;
        const message = await channel.messages.fetch(panel.messageId);
        await message.delete();
      } catch (error) {
        // Message might already be deleted
      }
    }

    return await this.ticketRepository.deletePanel(panelId, guild.id);
  }

  // Ticket creation
  async createTicket(interaction: ModalSubmitInteraction, panel: any, reason: string) {
    const guild = interaction.guild!;
    const member = interaction.member as GuildMember;
    const locale = await this.guildService.getGuildLanguage(guild.id);

    // Check user's open tickets
    const openTickets = await this.ticketRepository.getUserOpenTicketsByPanel(member.id, panel.id);
    if (openTickets.length >= panel.maxTicketsPerUser) {
      throw new Error(t('tickets.maxTicketsReached', { max: panel.maxTicketsPerUser }));
    }

    // Get next ticket number
    const ticketNumber = await this.ticketRepository.getNextTicketNumber(guild.id);
    const ticketName = panel.ticketNameFormat.replace('{number}', ticketNumber.toString());

    // Get or create category
    let category: CategoryChannel | null = null;
    if (panel.categoryId) {
      try {
        category = await guild.channels.fetch(panel.categoryId) as CategoryChannel;
      } catch (error) {
        // Category might have been deleted
      }
    }

    // Create ticket channel
    const ticketChannel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: category?.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
          type: OverwriteType.Role,
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
          type: OverwriteType.Member,
        },
        // Add support roles
        ...panel.supportRoles.map((roleId: string) => ({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages,
          ],
          type: OverwriteType.Role,
        })),
      ],
    });

    // Create ticket in database
    const ticket = await this.ticketRepository.createTicket({
      guildId: guild.id,
      panelId: panel.id,
      userId: member.id,
      channelId: ticketChannel.id,
      reason,
      ticketNumber,
    });

    // Create ticket embed
    const ticketEmbed = new EmbedBuilder()
      .setTitle(t('tickets.ticketCreated', { number: ticketNumber }))
      .setDescription(panel.welcomeMessage || t('tickets.welcomeMessage'))
      .addFields([
        {
          name: t('tickets.createdBy'),
          value: `<@${member.id}>`,
          inline: true,
        },
        {
          name: t('tickets.reason'),
          value: reason || t('tickets.noReason'),
          inline: false,
        },
      ])
      .setColor(0x00FF00)
      .setTimestamp();

    // Create control buttons
    const controlButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close:${ticket.id}`)
        .setLabel(t('tickets.close'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId(`ticket_close_reason:${ticket.id}`)
        .setLabel(t('tickets.closeWithReason'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setCustomId(`ticket_lock:${ticket.id}`)
        .setLabel(t('tickets.lock'))
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔐'),
      new ButtonBuilder()
        .setCustomId(`ticket_freeze:${ticket.id}`)
        .setLabel(t('tickets.freeze'))
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❄️'),
      new ButtonBuilder()
        .setCustomId(`ticket_claim:${ticket.id}`)
        .setLabel(t('tickets.claim'))
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🙋'),
    );

    // Send ticket panel and ping support roles
    const supportPings = panel.supportRoles.map((roleId: string) => `<@&${roleId}>`).join(' ');
    await ticketChannel.send({
      content: supportPings,
      embeds: [ticketEmbed],
      components: [controlButtons],
    });

    // Log ticket creation
    await this.ticketRepository.addTicketMessage(
      ticket.id,
      member.id,
      t('tickets.ticketCreatedLog', { user: member.user.tag, reason }),
    );

    return { ticket, channel: ticketChannel };
  }

  // Ticket actions
  async claimTicket(ticketId: string, claimedBy: GuildMember, locale: string) {
    const ticket = await this.ticketRepository.getTicket(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status !== 'open') {
      throw new Error(t('tickets.alreadyClaimed'));
    }

    await this.ticketRepository.updateTicketStatus(ticketId, 'claimed', claimedBy.id);
    await this.ticketRepository.addTicketMessage(
      ticketId,
      claimedBy.id,
      t('tickets.claimedBy', { user: claimedBy.user.tag }),
    );

    return ticket;
  }

  async closeTicket(ticketId: string, closedBy: GuildMember, reason?: string, locale?: string) {
    const ticket = await this.ticketRepository.getTicket(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new Error('Ticket already closed');
    }

    // Generate transcript
    const messages = await this.ticketRepository.getTicketMessages(ticketId);
    const transcript = this.generateTranscript(messages, ticket);

    // Close ticket
    await this.ticketRepository.closeTicket(ticketId, closedBy.id, reason);
    await this.ticketRepository.setTicketTranscript(ticketId, transcript);

    // Log closing
    await this.ticketRepository.addTicketMessage(
      ticketId,
      closedBy.id,
      t('tickets.closedBy', { 
        user: closedBy.user.tag, 
        reason: reason || 'No reason provided' 
      }),
    );

    return { ticket, transcript };
  }

  async lockTicket(ticketId: string, lockedBy: GuildMember, guild: Guild, locale: string) {
    const ticket = await this.ticketRepository.getTicket(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new Error('Cannot lock closed ticket');
    }

    // Update permissions
    const channel = await guild.channels.fetch(ticket.channelId) as TextChannel;
    await channel.permissionOverwrites.edit(ticket.userId, {
      SendMessages: false,
    });

    await this.ticketRepository.updateTicketStatus(ticketId, 'locked', lockedBy.id);
    await this.ticketRepository.addTicketMessage(
      ticketId,
      lockedBy.id,
      t('tickets.lockedBy', { user: lockedBy.user.tag }),
    );

    return ticket;
  }

  async freezeTicket(ticketId: string, frozenBy: GuildMember, guild: Guild, locale: string) {
    const ticket = await this.ticketRepository.getTicket(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new Error('Cannot freeze closed ticket');
    }

    // Update permissions - freeze prevents everyone except admins from sending
    const channel = await guild.channels.fetch(ticket.channelId) as TextChannel;
    
    // Get panel to access support roles
    const panel = ticket.panelId ? await this.ticketRepository.getPanelById(ticket.panelId) : null;
    
    // Deny send messages for user
    await channel.permissionOverwrites.edit(ticket.userId, {
      SendMessages: false,
    });

    // Deny send messages for support roles
    if (panel && panel.supportRoles) {
      for (const roleId of panel.supportRoles as string[]) {
        await channel.permissionOverwrites.edit(roleId, {
          SendMessages: false,
        });
      }
    }

    await this.ticketRepository.updateTicketStatus(ticketId, 'frozen', frozenBy.id);
    await this.ticketRepository.addTicketMessage(
      ticketId,
      frozenBy.id,
      t('tickets.frozenBy', { user: frozenBy.user.tag }),
    );

    return ticket;
  }

  // Helper methods
  private generateTranscript(messages: any[], ticket: any): string {
    let transcript = `Ticket #${ticket.ticketNumber} Transcript\n`;
    transcript += `Created: ${ticket.createdAt}\n`;
    transcript += `Closed: ${new Date().toISOString()}\n`;
    transcript += `User: ${ticket.userId}\n`;
    transcript += `Reason: ${ticket.reason || 'No reason provided'}\n\n`;
    transcript += `Messages:\n`;
    transcript += `${'='.repeat(50)  }\n\n`;

    for (const msg of messages) {
      transcript += `[${msg.createdAt}] ${msg.userId}: ${msg.content}\n`;
      if (msg.attachments && msg.attachments.length > 0) {
        transcript += `Attachments: ${JSON.stringify(msg.attachments)}\n`;
      }
      transcript += '\n';
    }

    return transcript;
  }

  // Modal builders
  createTicketModal(panelId: string, locale: string): ModalBuilder {
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal:${panelId}`)
      .setTitle(t('tickets.createTicket'));

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel(t('tickets.reasonLabel'))
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(t('tickets.reasonPlaceholder'))
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1000);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(row);

    return modal;
  }

  createCloseReasonModal(ticketId: string, locale: string): ModalBuilder {
    const modal = new ModalBuilder()
      .setCustomId(`ticket_close_modal:${ticketId}`)
      .setTitle(t('tickets.closeTicket'));

    const reasonInput = new TextInputBuilder()
      .setCustomId('closeReason')
      .setLabel(t('tickets.closeReasonLabel'))
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(t('tickets.closeReasonPlaceholder'))
      .setRequired(false)
      .setMaxLength(1000);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(row);

    return modal;
  }
}