// src/modules/tickets/TicketManager.ts - Fixed Ticket System
import {
  Guild,
  TextChannel,
  CategoryChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  User,
  GuildMember,
  Message,
  ButtonInteraction,
  ChannelType
} from 'discord.js';
import { PrismaClient, TicketStatus, TicketPriority } from '@prisma/client';
import { Logger } from '../../utils/Logger.js';
import { Config } from '../../config/Config.js';
import { ExtendedClient } from '../../index.js';
import fs from 'fs';
import path from 'path';

export interface TicketOptions {
  userId: string;
  category: string;
  subject: string;
  priority?: TicketPriority;
  description?: string;
}

export interface TicketData {
  id: number;
  guildId: string;
  userId: string;
  channelId: string;
  status: TicketStatus;
  category: string;
  subject: string;
  priority: TicketPriority;
  moderatorId?: string | null;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TicketManager {
  private client: ExtendedClient;
  private db: PrismaClient;
  private logger: typeof Logger;

  constructor(client: ExtendedClient, db: PrismaClient, logger: typeof Logger) {
    this.client = client;
    this.db = db;
    this.logger = logger;
  }

  /**
   * Create a new ticket
   */
  async createTicket(guild: Guild, options: TicketOptions): Promise<{ success: boolean; ticket?: TicketData; channel?: TextChannel; error?: string }> {
    try {
      // Check if user already has maximum open tickets
      const openTickets = await this.db.ticket.count({
        where: {
          guildId: guild.id,
          userId: options.userId,
          status: {
            in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING]
          }
        }
      });

      if (openTickets >= Config.TICKET.MAX_OPEN_PER_USER) {
        return { success: false, error: `You can only have ${Config.TICKET.MAX_OPEN_PER_USER} open tickets at a time.` };
      }

      // Create or get tickets category
      let ticketsCategory = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('tickets')
      ) as CategoryChannel;

      if (!ticketsCategory) {
        ticketsCategory = await guild.channels.create({
          name: 'Tickets',
          type: ChannelType.GuildCategory,
          reason: 'Ticket system setup'
        });
      }

      // Generate unique ticket channel name
      const ticketNumber = await this.getNextTicketNumber(guild.id);
      const channelName = `ticket-${ticketNumber}`;

      // Create ticket channel
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketsCategory,
        reason: `Ticket created by ${options.userId}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: options.userId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: this.client.user!.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          }
        ]
      });

      // Add staff role permissions if configured
      const guildSettings = await this.db.guild.findUnique({
        where: { id: guild.id }
      });

      let staffRoleId: string | null = null;
      if (guildSettings?.settings && typeof guildSettings.settings === 'object') {
        const settings = guildSettings.settings as any;
        staffRoleId = settings.staffRoleId || null;
      }

      if (staffRoleId) {
        await ticketChannel.permissionOverwrites.create(staffRoleId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
          ManageMessages: true
        });
      }

      // Create ticket in database
      const ticket = await this.db.ticket.create({
        data: {
          guildId: guild.id,
          userId: options.userId,
          channelId: ticketChannel.id,
          status: TicketStatus.OPEN,
          category: options.category,
          subject: options.subject,
          priority: options.priority || TicketPriority.MEDIUM
        }
      });

      // Send initial ticket message
      await this.sendTicketWelcomeMessage(ticketChannel, ticket as TicketData, options.description);

      // Log the action
      await this.logTicketAction(guild.id, 'TICKET_CREATED', ticket as TicketData);

      // Emit to dashboard
      this.client.wsManager.emitRealtimeEvent(guild.id, 'ticket:created', {
        id: ticket.id,
        subject: ticket.subject,
        category: ticket.category,
        userId: ticket.userId,
        channelId: ticket.channelId,
        priority: ticket.priority
      });

      this.logger.info(`Ticket ${ticket.id} created in ${guild.name} by ${options.userId}`);

      return { success: true, ticket: ticket as TicketData, channel: ticketChannel };

    } catch (error) {
      this.logger.error('Error creating ticket:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Close a ticket
   */
  async closeTicket(
    ticketId: number,
    moderatorId: string,
    reason?: string
  ): Promise<{ success: boolean; transcript?: string; error?: string }> {
    try {
      const ticket = await this.db.ticket.findUnique({
        where: { id: ticketId }
      });

      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      if (ticket.status === TicketStatus.CLOSED) {
        return { success: false, error: 'Ticket is already closed' };
      }

      const guild = this.client.guilds.cache.get(ticket.guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const channel = guild.channels.cache.get(ticket.channelId) as TextChannel;
      
      // Generate transcript if channel exists
      let transcript: string | undefined;
      if (channel) {
        transcript = await this.generateTranscript(channel);
        await this.saveTranscript(ticket as TicketData, transcript);
      }

      // Update ticket in database
      await this.db.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.CLOSED,
          moderatorId,
          closedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Send closure notification
      if (channel) {
        await this.sendTicketClosureMessage(channel, moderatorId, reason);
        
        // Delete channel after a delay
        setTimeout(async () => {
          try {
            await channel.delete('Ticket closed');
          } catch (error) {
            this.logger.warn('Failed to delete ticket channel:', error);
          }
        }, 10000); // 10 seconds delay
      }

      // Notify user via DM
      try {
        const user = await this.client.users.fetch(ticket.userId);
        const moderator = await this.client.users.fetch(moderatorId);
        
        const embed = new EmbedBuilder()
          .setTitle(`${Config.EMOJIS.TICKET} Ticket Closed`)
          .setDescription(`Your ticket in **${guild.name}** has been closed.`)
          .addFields(
            { name: 'Ticket', value: ticket.subject, inline: true },
            { name: 'Category', value: ticket.category, inline: true },
            { name: 'Closed by', value: moderator.tag, inline: true }
          )
          .setColor(Config.COLORS.INFO)
          .setTimestamp();

        if (reason) {
          embed.addFields({ name: 'Reason', value: reason });
        }

        await user.send({ embeds: [embed] });
      } catch (error) {
        this.logger.warn('Failed to send ticket closure DM:', error);
      }

      // Log the action
      await this.logTicketAction(ticket.guildId, 'TICKET_CLOSED', ticket as TicketData, moderatorId);

      // Emit to dashboard
      this.client.wsManager.emitRealtimeEvent(ticket.guildId, 'ticket:closed', {
        id: ticket.id,
        subject: ticket.subject,
        moderatorId,
        reason
      });

      this.logger.info(`Ticket ${ticketId} closed by ${moderatorId}`);

      return { success: true, transcript };

    } catch (error) {
      this.logger.error('Error closing ticket:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Add user to ticket
   */
  async addUserToTicket(ticketId: number, userId: string, moderatorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const ticket = await this.db.ticket.findUnique({
        where: { id: ticketId }
      });

      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      if (ticket.status === TicketStatus.CLOSED) {
        return { success: false, error: 'Cannot add users to closed tickets' };
      }

      const guild = this.client.guilds.cache.get(ticket.guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const channel = guild.channels.cache.get(ticket.channelId) as TextChannel;
      if (!channel) {
        return { success: false, error: 'Ticket channel not found' };
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return { success: false, error: 'User not found in guild' };
      }

      // Add permissions for the user
      await channel.permissionOverwrites.create(userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
      });

      // Send notification message
      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.TICKET} User Added`)
        .setDescription(`${member} has been added to this ticket by <@${moderatorId}>`)
        .setColor(Config.COLORS.SUCCESS)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      this.logger.info(`User ${userId} added to ticket ${ticketId} by ${moderatorId}`);

      return { success: true };

    } catch (error) {
      this.logger.error('Error adding user to ticket:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Remove user from ticket
   */
  async removeUserFromTicket(ticketId: number, userId: string, moderatorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const ticket = await this.db.ticket.findUnique({
        where: { id: ticketId }
      });

      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      if (ticket.userId === userId) {
        return { success: false, error: 'Cannot remove the ticket owner' };
      }

      const guild = this.client.guilds.cache.get(ticket.guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const channel = guild.channels.cache.get(ticket.channelId) as TextChannel;
      if (!channel) {
        return { success: false, error: 'Ticket channel not found' };
      }

      // Remove permissions for the user
      await channel.permissionOverwrites.delete(userId);

      // Send notification message
      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.TICKET} User Removed`)
        .setDescription(`<@${userId}> has been removed from this ticket by <@${moderatorId}>`)
        .setColor(Config.COLORS.WARNING)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      this.logger.info(`User ${userId} removed from ticket ${ticketId} by ${moderatorId}`);

      return { success: true };

    } catch (error) {
      this.logger.error('Error removing user from ticket:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Set ticket priority
   */
  async setTicketPriority(ticketId: number, priority: TicketPriority, moderatorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const ticket = await this.db.ticket.findUnique({
        where: { id: ticketId }
      });

      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      await this.db.ticket.update({
        where: { id: ticketId },
        data: { priority, updatedAt: new Date() }
      });

      const guild = this.client.guilds.cache.get(ticket.guildId);
      const channel = guild?.channels.cache.get(ticket.channelId) as TextChannel;

      if (channel) {
        const priorityEmoji = this.getPriorityEmoji(priority);
        const embed = new EmbedBuilder()
          .setTitle(`${Config.EMOJIS.TICKET} Priority Updated`)
          .setDescription(`Ticket priority changed to **${priority}** ${priorityEmoji} by <@${moderatorId}>`)
          .setColor(this.getPriorityColor(priority))
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }

      this.logger.info(`Ticket ${ticketId} priority changed to ${priority} by ${moderatorId}`);

      return { success: true };

    } catch (error) {
      this.logger.error('Error setting ticket priority:', error);
      return { success: false, error: 'Internal error occurred' };
    }
  }

  /**
   * Handle button interactions for ticket controls
   */
  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      if (!interaction.guild) return;

      // Parse custom ID: format is "ticket:action:ticketId" or "ticket:action"
      const [prefix, action, ticketIdStr] = interaction.customId.split(':');
      
      if (prefix !== 'ticket') {
        return;
      }

      switch (action) {
        case 'close':
          if (ticketIdStr) {
            const ticketId = parseInt(ticketIdStr);
            if (!isNaN(ticketId)) {
              const result = await this.closeTicket(ticketId, interaction.user.id, 'Closed via button');
              if (result.success) {
                await interaction.reply({ content: `✅ Ticket has been closed.`, ephemeral: true });
              } else {
                await interaction.reply({ content: `❌ Failed to close ticket: ${result.error}`, ephemeral: true });
              }
            }
          } else {
            // Handle channel-based close
            await this.handleChannelBasedClose(interaction);
          }
          break;
        
        default:
          await interaction.reply({ content: 'Unknown ticket action.', ephemeral: true });
          break;
      }

    } catch (error) {
      this.logger.error('Error handling ticket button interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing this action.', 
          ephemeral: true 
        });
      }
    }
  }

  /**
   * Handle channel-based ticket close
   */
  private async handleChannelBasedClose(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: 'This command can only be used in a text channel.', ephemeral: true });
      return;
    }

    const channelName = interaction.channel.name;
    if (!channelName.startsWith('ticket-')) {
      await interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
      return;
    }

    const ticketNumber = channelName.split('-')[1];
    const ticketId = parseInt(ticketNumber);

    if (isNaN(ticketId)) {
      await interaction.reply({ content: 'Invalid ticket channel.', ephemeral: true });
      return;
    }

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
      return;
    }

    const isOwner = ticket.userId === interaction.user.id;
    const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);

    if (!isOwner && !isStaff) {
      await interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });
      return;
    }

    const result = await this.closeTicket(ticketId, interaction.user.id, 'Closed via button');

    if (result.success) {
      await interaction.reply({ content: `✅ Ticket closed successfully.` });
    } else {
      await interaction.reply({ content: `❌ Failed to close ticket: ${result.error}`, ephemeral: true });
    }
  }

  /**
   * Get ticket data by ID
   */
  async getTicket(ticketId: number): Promise<TicketData | null> {
    try {
      const ticket = await this.db.ticket.findUnique({
        where: { id: ticketId }
      });

      return ticket as TicketData | null;
    } catch (error) {
      this.logger.error('Error getting ticket:', error);
      return null;
    }
  }

  /**
   * Get open tickets for a guild
   */
  async getOpenTickets(guildId: string): Promise<TicketData[]> {
    try {
      const tickets = await this.db.ticket.findMany({
        where: {
          guildId,
          status: {
            in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING]
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return tickets as TicketData[];
    } catch (error) {
      this.logger.error('Error getting open tickets:', error);
      return [];
    }
  }

  /**
   * Get user's tickets
   */
  async getUserTickets(guildId: string, userId: string, limit = 10): Promise<TicketData[]> {
    try {
      const tickets = await this.db.ticket.findMany({
        where: {
          guildId,
          userId
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return tickets as TicketData[];
    } catch (error) {
      this.logger.error('Error getting user tickets:', error);
      return [];
    }
  }

  /**
   * Generate ticket transcript
   */
  private async generateTranscript(channel: TextChannel): Promise<string> {
    try {
      const messages = await this.fetchAllMessages(channel);
      
      let transcript = `# Ticket Transcript - ${channel.name}\n`;
      transcript += `Channel: ${channel.name} (${channel.id})\n`;
      transcript += `Guild: ${channel.guild.name} (${channel.guild.id})\n`;
      transcript += `Generated: ${new Date().toISOString()}\n`;
      transcript += `Messages: ${messages.length}\n\n`;
      transcript += '---\n\n';

      for (const message of messages.reverse()) {
        const timestamp = message.createdAt.toISOString();
        const author = `${message.author.tag} (${message.author.id})`;
        
        transcript += `[${timestamp}] ${author}:\n`;
        
        if (message.content) {
          transcript += `${message.content}\n`;
        }
        
        if (message.attachments.size > 0) {
          for (const attachment of message.attachments.values()) {
            transcript += `[Attachment: ${attachment.name} - ${attachment.url}]\n`;
          }
        }
        
        if (message.embeds.length > 0) {
          transcript += `[${message.embeds.length} embed(s)]\n`;
        }
        
        transcript += '\n';
      }

      return transcript;

    } catch (error) {
      this.logger.error('Error generating transcript:', error);
      return 'Error generating transcript';
    }
  }

  /**
   * Fetch all messages from a channel
   */
  private async fetchAllMessages(channel: TextChannel): Promise<Message[]> {
    const messages: Message[] = [];
    let lastMessageId: string | undefined;

    while (true) {
      const fetchedMessages = await channel.messages.fetch({
        limit: 100,
        before: lastMessageId
      });

      if (fetchedMessages.size === 0) break;

      messages.push(...fetchedMessages.values());
      lastMessageId = fetchedMessages.last()?.id;
    }

    return messages;
  }

  /**
   * Save transcript to file
   */
  private async saveTranscript(ticket: TicketData, transcript: string): Promise<void> {
    try {
      const transcriptsDir = path.join(process.cwd(), 'transcripts');
      
      if (!fs.existsSync(transcriptsDir)) {
        fs.mkdirSync(transcriptsDir, { recursive: true });
      }

      const filename = `ticket-${ticket.id}-${Date.now()}.txt`;
      const filepath = path.join(transcriptsDir, filename);

      fs.writeFileSync(filepath, transcript, 'utf8');

      this.logger.info(`Transcript saved for ticket ${ticket.id}: ${filename}`);

    } catch (error) {
      this.logger.error('Error saving transcript:', error);
    }
  }

  /**
   * Send ticket welcome message
   */
  private async sendTicketWelcomeMessage(channel: TextChannel, ticket: TicketData, description?: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(ticket.userId);
      const priorityEmoji = this.getPriorityEmoji(ticket.priority as TicketPriority);

      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.TICKET} Support Ticket`)
        .setDescription(`Hello ${user}, thank you for creating a support ticket. Our staff will be with you shortly.`)
        .addFields(
          { name: 'Subject', value: ticket.subject, inline: true },
          { name: 'Category', value: ticket.category, inline: true },
          { name: 'Priority', value: `${ticket.priority} ${priorityEmoji}`, inline: true },
          { name: 'Ticket ID', value: ticket.id.toString(), inline: true },
          { name: 'Created', value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:F>`, inline: true }
        )
        .setColor(Config.COLORS.TICKET)
        .setTimestamp();

      if (description) {
        embed.addFields({ name: 'Description', value: description });
      }

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket:close`)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
        );

      await channel.send({ content: `${user}`, embeds: [embed], components: [row] });

    } catch (error) {
      this.logger.error('Error sending ticket welcome message:', error);
    }
  }

  /**
   * Send ticket closure message
   */
  private async sendTicketClosureMessage(channel: TextChannel, moderatorId: string, reason?: string): Promise<void> {
    try {
      const moderator = await this.client.users.fetch(moderatorId);

      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.TICKET} Ticket Closed`)
        .setDescription(`This ticket has been closed by ${moderator.tag}`)
        .addFields(
          { name: 'Closed by', value: `${moderator.tag} (${moderator.id})`, inline: true },
          { name: 'Closed at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setColor(Config.COLORS.ERROR)
        .setTimestamp();

      if (reason) {
        embed.addFields({ name: 'Reason', value: reason });
      }

      embed.setFooter({ text: 'This channel will be deleted in 10 seconds.' });

      await channel.send({ embeds: [embed] });

    } catch (error) {
      this.logger.error('Error sending ticket closure message:', error);
    }
  }

  /**
   * Get next ticket number for guild
   */
  private async getNextTicketNumber(guildId: string): Promise<number> {
    try {
      const lastTicket = await this.db.ticket.findFirst({
        where: { guildId },
        orderBy: { id: 'desc' }
      });

      return (lastTicket?.id || 0) + 1;

    } catch (error) {
      this.logger.error('Error getting next ticket number:', error);
      return Date.now(); // Fallback to timestamp
    }
  }

  /**
   * Get priority emoji
   */
  private getPriorityEmoji(priority: TicketPriority): string {
    switch (priority) {
      case TicketPriority.LOW: return '🟢';
      case TicketPriority.MEDIUM: return '🟡';
      case TicketPriority.HIGH: return '🟠';
      case TicketPriority.URGENT: return '🔴';
      default: return '⚪';
    }
  }

  /**
   * Get priority color
   */
  private getPriorityColor(priority: TicketPriority): number {
    switch (priority) {
      case TicketPriority.LOW: return 0x00FF00;
      case TicketPriority.MEDIUM: return 0xFFFF00;
      case TicketPriority.HIGH: return 0xFF8C00;
      case TicketPriority.URGENT: return 0xFF0000;
      default: return 0x808080;
    }
  }

  /**
   * Log ticket action
   */
  private async logTicketAction(
    guildId: string,
    action: 'TICKET_CREATED' | 'TICKET_CLOSED' | 'TICKET_PRIORITY_CHANGED',
    ticket: TicketData,
    moderatorId?: string
  ): Promise<void> {
    try {
      const guildSettings = await this.db.guild.findUnique({
        where: { id: guildId }
      });

      let modLogChannelId: string | null = null;
      if (guildSettings?.settings && typeof guildSettings.settings === 'object') {
        const settings = guildSettings.settings as any;
        modLogChannelId = settings.modLogChannelId || null;
      }

      if (!modLogChannelId) {
        return;
      }

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return;

      const logChannel = guild.channels.cache.get(modLogChannelId) as TextChannel;
      if (!logChannel) return;

      const user = await this.client.users.fetch(ticket.userId).catch(() => null);
      const moderator = moderatorId ? await this.client.users.fetch(moderatorId).catch(() => null) : null;

      const embed = new EmbedBuilder()
        .setTitle(`${Config.EMOJIS.TICKET} Ticket ${action.split('_')[1]}`)
        .addFields(
          { name: 'Ticket ID', value: ticket.id.toString(), inline: true },
          { name: 'Subject', value: ticket.subject, inline: true },
          { name: 'Category', value: ticket.category, inline: true },
          { name: 'User', value: user ? `${user.tag} (${user.id})` : ticket.userId, inline: true },
          { name: 'Priority', value: ticket.priority, inline: true },
          { name: 'Status', value: ticket.status, inline: true }
        )
        .setColor(
          action === 'TICKET_CREATED' ? Config.COLORS.SUCCESS :
          action === 'TICKET_CLOSED' ? Config.COLORS.ERROR :
          Config.COLORS.WARNING
        )
        .setTimestamp();

      if (moderator && action !== 'TICKET_CREATED') {
        embed.addFields({ name: `${action.split('_')[1]} by`, value: `${moderator.tag} (${moderator.id})`, inline: true });
      }

      await logChannel.send({ embeds: [embed] });

    } catch (error) {
      this.logger.error('Error logging ticket action:', error);
    }
  }

  /**
   * Clean up old closed tickets
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up old closed tickets (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      await this.db.ticket.deleteMany({
        where: {
          status: TicketStatus.CLOSED,
          closedAt: {
            lt: thirtyDaysAgo
          }
        }
      });

      this.logger.info('Ticket system cleanup completed');

    } catch (error) {
      this.logger.error('Error during ticket cleanup:', error);
    }
  }

  /**
   * Initialize ticket system for guild
   */
  async initializeGuild(guild: Guild): Promise<void> {
    try {
      this.logger.info(`Initialized ticket system for guild ${guild.name}`);
    } catch (error) {
      this.logger.error('Error initializing ticket system for guild:', error);
    }
  }
}