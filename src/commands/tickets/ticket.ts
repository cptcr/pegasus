// src/commands/tickets/ticket.ts - Fixed Ticket Commands
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';
import { TicketPriority } from '@prisma/client';
import { Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('open')
        .setDescription('Open a new support ticket')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Ticket category')
            .setRequired(true)
            .addChoices(
              { name: 'General Support', value: 'general' },
              { name: 'Technical Issue', value: 'technical' },
              { name: 'Bug Report', value: 'bug' },
              { name: 'Feature Request', value: 'feature' },
              { name: 'Account Issue', value: 'account' }
            )
        )
        .addStringOption(option =>
          option
            .setName('subject')
            .setDescription('Brief description of your issue')
            .setRequired(true)
            .setMaxLength(Config.LIMITS.TICKET_SUBJECT_LENGTH)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Detailed description of your issue')
            .setMaxLength(1024)
        )
        .addStringOption(option =>
          option
            .setName('priority')
            .setDescription('Ticket priority')
            .addChoices(
              { name: 'Low', value: 'LOW' },
              { name: 'Medium', value: 'MEDIUM' },
              { name: 'High', value: 'HIGH' },
              { name: 'Urgent', value: 'URGENT' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close a ticket')
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for closing the ticket')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a user to the ticket')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to add to the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a user from the ticket')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to remove from the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('priority')
        .setDescription('Set ticket priority')
        .addStringOption(option =>
          option
            .setName('priority')
            .setDescription('New priority level')
            .setRequired(true)
            .addChoices(
              { name: 'Low', value: 'LOW' },
              { name: 'Medium', value: 'MEDIUM' },
              { name: 'High', value: 'HIGH' },
              { name: 'Urgent', value: 'URGENT' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List your tickets or all tickets (staff only)')
        .addBooleanOption(option =>
          option
            .setName('all')
            .setDescription('Show all tickets (staff only)')
        )
    ),
  category: 'tickets',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a guild.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'open':
        await handleTicketOpen(interaction, client);
        break;
      case 'close':
        await handleTicketClose(interaction, client);
        break;
      case 'add':
        await handleTicketAdd(interaction, client);
        break;
      case 'remove':
        await handleTicketRemove(interaction, client);
        break;
      case 'priority':
        await handleTicketPriority(interaction, client);
        break;
      case 'list':
        await handleTicketList(interaction, client);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        break;
    }
  }
};

async function handleTicketOpen(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const category = interaction.options.getString('category', true);
  const subject = interaction.options.getString('subject', true);
  const description = interaction.options.getString('description');
  const priorityStr = interaction.options.getString('priority') || 'MEDIUM';

  const priority = priorityStr as TicketPriority;

  const result = await client.ticketManager.createTicket(interaction.guild!, {
    userId: interaction.user.id,
    category,
    subject,
    description: description || undefined,
    priority
  });

  if (!result.success) {
    await interaction.editReply(`Failed to create ticket: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Ticket Created`)
    .setDescription(`Your ticket has been created successfully!`)
    .addFields(
      { name: 'Ticket ID', value: result.ticket!.id.toString(), inline: true },
      { name: 'Subject', value: subject, inline: true },
      { name: 'Category', value: category, inline: true },
      { name: 'Channel', value: `<#${result.channel!.id}>`, inline: true }
    )
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleTicketClose(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply();

  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    await interaction.editReply('This command can only be used in a text channel.');
    return;
  }

  const channelName = interaction.channel.name;
  if (!channelName.startsWith('ticket-')) {
    await interaction.editReply('This command can only be used in a ticket channel.');
    return;
  }

  const reason = interaction.options.getString('reason') || 'No reason provided';

  const ticketNumber = channelName.split('-')[1];
  const ticketId = parseInt(ticketNumber);

  if (isNaN(ticketId)) {
    await interaction.editReply('Invalid ticket channel.');
    return;
  }

  const ticket = await client.ticketManager.getTicket(ticketId);
  if (!ticket) {
    await interaction.editReply('Ticket not found.');
    return;
  }

  const isOwner = ticket.userId === interaction.user.id;
  const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);

  if (!isOwner && !isStaff) {
    await interaction.editReply('You do not have permission to close this ticket.');
    return;
  }

  const result = await client.ticketManager.closeTicket(ticketId, interaction.user.id, reason);

  if (!result.success) {
    await interaction.editReply(`Failed to close ticket: ${result.error}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.SUCCESS} Ticket Closed`)
    .setDescription(`Ticket closed successfully.`)
    .addFields({ name: 'Reason', value: reason })
    .setColor(Config.COLORS.SUCCESS)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleTicketAdd(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  
  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    await interaction.editReply('This command can only be used in a text channel.');
    return;
  }

  const channelName = interaction.channel.name;
  if (!channelName.startsWith('ticket-')) {
    await interaction.editReply('This command can only be used in a ticket channel.');
    return;
  }

  const ticketNumber = channelName.split('-')[1];
  const ticketId = parseInt(ticketNumber);

  if (isNaN(ticketId)) {
    await interaction.editReply('Invalid ticket channel.');
    return;
  }

  const result = await client.ticketManager.addUserToTicket(ticketId, user.id, interaction.user.id);

  if (!result.success) {
    await interaction.editReply(`Failed to add user: ${result.error}`);
    return;
  }

  await interaction.editReply(`${Config.EMOJIS.SUCCESS} ${user.displayName} has been added to this ticket.`);
}

async function handleTicketRemove(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  
  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    await interaction.editReply('This command can only be used in a text channel.');
    return;
  }

  const channelName = interaction.channel.name;
  if (!channelName.startsWith('ticket-')) {
    await interaction.editReply('This command can only be used in a ticket channel.');
    return;
  }

  const ticketNumber = channelName.split('-')[1];
  const ticketId = parseInt(ticketNumber);

  if (isNaN(ticketId)) {
    await interaction.editReply('Invalid ticket channel.');
    return;
  }

  const result = await client.ticketManager.removeUserFromTicket(ticketId, user.id, interaction.user.id);

  if (!result.success) {
    await interaction.editReply(`Failed to remove user: ${result.error}`);
    return;
  }

  await interaction.editReply(`${Config.EMOJIS.SUCCESS} ${user.displayName} has been removed from this ticket.`);
}

async function handleTicketPriority(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply();

  const priorityStr = interaction.options.getString('priority', true);
  const priority = priorityStr as TicketPriority;
  
  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    await interaction.editReply('This command can only be used in a text channel.');
    return;
  }

  const channelName = interaction.channel.name;
  if (!channelName.startsWith('ticket-')) {
    await interaction.editReply('This command can only be used in a ticket channel.');
    return;
  }

  const ticketNumber = channelName.split('-')[1];
  const ticketId = parseInt(ticketNumber);

  if (isNaN(ticketId)) {
    await interaction.editReply('Invalid ticket channel.');
    return;
  }

  const result = await client.ticketManager.setTicketPriority(ticketId, priority, interaction.user.id);

  if (!result.success) {
    await interaction.editReply(`Failed to set priority: ${result.error}`);
    return;
  }

  await interaction.editReply(`${Config.EMOJIS.SUCCESS} Ticket priority set to **${priority}**.`);
}

async function handleTicketList(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
  await interaction.deferReply();

  const showAll = interaction.options.getBoolean('all') || false;

  if (showAll && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.editReply('You need Manage Channels permission to view all tickets.');
    return;
  }

  let tickets;
  if (showAll) {
    tickets = await client.ticketManager.getOpenTickets(interaction.guild!.id);
  } else {
    tickets = await client.ticketManager.getUserTickets(interaction.guild!.id, interaction.user.id);
  }

  if (tickets.length === 0) {
    await interaction.editReply(showAll ? 'No open tickets in this guild.' : 'You have no tickets.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${Config.EMOJIS.TICKET} ${showAll ? 'All Open Tickets' : 'Your Tickets'}`)
    .setDescription(`${tickets.length} ticket(s) found`)
    .setColor(Config.COLORS.INFO)
    .setTimestamp();

  for (let i = 0; i < Math.min(tickets.length, 10); i++) {
    const ticket = tickets[i];
    const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
    
    embed.addFields({
      name: `ID: ${ticket.id} - ${ticket.subject}`,
      value: `**User:** ${user?.displayName || ticket.userId}\n**Category:** ${ticket.category}\n**Status:** ${ticket.status}\n**Priority:** ${ticket.priority}\n**Created:** <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`,
      inline: false
    });
  }

  if (tickets.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${tickets.length} tickets` });
  }

  await interaction.editReply({ embeds: [embed] });
}

export default command;