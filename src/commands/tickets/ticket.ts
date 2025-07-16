import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { ticketHandler } from '../../handlers/tickets';

export const data = new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage ticket system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('panel')
        .setDescription('Create a ticket panel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Channel to send the ticket panel to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Title of the ticket panel')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of the ticket panel')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName('category')
            .setDescription('Category to create ticket channels in')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addRoleOption(option =>
          option.setName('support_role')
            .setDescription('Support role for tickets')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('color')
            .setDescription('Color of the embed (hex code)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all ticket panels')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Show ticket statistics')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false);

export async function execute(interaction: any) {
  if (!interaction.guild) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'panel':
      await handlePanelCreate(interaction);
      break;
    case 'list':
      await handlePanelList(interaction);
      break;
    case 'stats':
      await handleStats(interaction);
      break;
  }
}

async function handlePanelCreate(interaction: any) {
    if (!interaction.guild) return;

    const channel = interaction.options.getChannel('channel', true);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const category = interaction.options.getChannel('category', true);
    const supportRole = interaction.options.getRole('support_role');
    const color = interaction.options.getString('color') || '#0099ff';

    if (!channel.isTextBased()) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'Channel must be a text channel.')],
        ephemeral: true,
      });
    }

    if (category.type !== ChannelType.GuildCategory) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'Category must be a category channel.')],
        ephemeral: true,
      });
    }

    const supportRoles = supportRole ? [supportRole.id] : [];

    await interaction.deferReply({ ephemeral: true });

    const panelId = await ticketHandler.createTicketPanel(
      interaction.guild.id,
      channel.id,
      title,
      description,
      category.id,
      supportRoles,
      color
    );

    if (!panelId) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to create ticket panel.')],
      });
    }

    await interaction.editReply({
      embeds: [createSuccessEmbed('Panel Created', `Ticket panel created successfully in ${channel}`)],
    });
  }

async function handlePanelList(interaction: any) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const panels = await ticketHandler.getTicketPanels(interaction.guild.id);

    if (panels.length === 0) {
      return interaction.editReply({
        embeds: [createErrorEmbed('No Panels', 'No ticket panels found.')],
      });
    }

    const embed = createSuccessEmbed('Ticket Panels', 'List of all ticket panels in this server');

    panels.forEach((panel, index) => {
      const channel = interaction.guild?.channels.cache.get(panel.channel_id);
      const category = interaction.guild?.channels.cache.get(panel.category);

      embed.addFields({
        name: `${index + 1}. ${panel.title}`,
        value: `Channel: ${channel || 'Unknown'}\nCategory: ${category || 'Unknown'}\nCreated: <t:${Math.floor(new Date(panel.created_at).getTime() / 1000)}:R>`,
        inline: true,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  }

async function handleStats(interaction: any) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const openTickets = await ticketHandler.getTickets(interaction.guild.id, 'open');
    const closedTickets = await ticketHandler.getTickets(interaction.guild.id, 'closed');
    const totalTickets = openTickets.length + closedTickets.length;

    const embed = createSuccessEmbed('Ticket Statistics', `Statistics for ${interaction.guild.name}`);

    embed.addFields(
      {
        name: 'Open Tickets',
        value: openTickets.length.toString(),
        inline: true,
      },
      {
        name: 'Closed Tickets',
        value: closedTickets.length.toString(),
        inline: true,
      },
      {
        name: 'Total Tickets',
        value: totalTickets.toString(),
        inline: true,
      }
    );

    await interaction.editReply({ embeds: [embed] });
  }