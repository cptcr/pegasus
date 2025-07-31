import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ticketHandler } from '../../handlers/tickets';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { colors } from '../../utils/config';
import { i18n } from '../../i18n';

export const command = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Create and manage ticket panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new ticket panel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to deploy the ticket panel')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Title for the ticket panel')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Description for the ticket panel')
            .setRequired(true)
            .setMaxLength(1000)
        )
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('Embed color (hex code)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('thumbnail')
            .setDescription('Thumbnail URL for the embed')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('image')
            .setDescription('Image URL for the embed')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all ticket panels in this server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a ticket panel')
        .addStringOption(option =>
          option
            .setName('panel_id')
            .setDescription('ID of the panel to delete')
            .setRequired(true)
        )
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreatePanel(interaction);
        break;
      case 'list':
        await handleListPanels(interaction);
        break;
      case 'delete':
        await handleDeletePanel(interaction);
        break;
    }
  },
};

async function handleCreatePanel(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel('channel', true);
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description', true);
  const color = interaction.options.getString('color') || colors.primary;
  const thumbnail = interaction.options.getString('thumbnail');
  const image = interaction.options.getString('image');

  // Validate color
  const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (!colorRegex.test(color)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Invalid Color', 'Please provide a valid hex color code (e.g., #3498db)')],
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  try {
    // Create default button for simple panels
    const defaultButtons = [{
      id: 'default',
      label: 'Create Ticket',
      emoji: '🎫',
      style: 1, // ButtonStyle.Primary
      category_id: 'default',
      description: 'Create a support ticket'
    }];

    const panelId = await ticketHandler.createTicketPanel(
      interaction.guild.id,
      channel.id,
      title,
      description,
      defaultButtons,
      {
        color,
        thumbnail: thumbnail || undefined,
        image: image || undefined,
        supportRoles: [],
        pingRoles: []
      }
    );

    if (panelId) {
      const embed = createSuccessEmbed(
        '✅ Ticket Panel Created',
        `Successfully created a ticket panel in ${channel}!\n\n` +
        `**Panel ID:** \`${panelId}\`\n` +
        `**Title:** ${title}\n` +
        `**Description:** ${description}`
      );

      embed.addFields(
        {
          name: '📝 Next Steps',
          value: 'You can now:\n' +
                 '• Use `/ticket category create` to add custom categories\n' +
                 '• Use `/ticket settings` to configure the ticket system\n' +
                 '• Users can click the button to create tickets!',
          inline: false
        }
      );

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to create ticket panel. Please try again.')]
      });
    }
  } catch (error) {
    console.error('Error creating ticket panel:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'An error occurred while creating the ticket panel.')]
    });
  }
}

async function handleListPanels(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply();

  try {
    const panels = await ticketHandler.getTicketPanels(interaction.guild.id);

    if (panels.length === 0) {
      const embed = createEmbed({
        title: '📋 Ticket Panels',
        description: 'No ticket panels found in this server.\n\nUse `/panel create` to create your first ticket panel!',
        color: colors.secondary
      });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = createEmbed({
      title: '📋 Ticket Panels',
      description: `Found ${panels.length} ticket panel(s) in this server:`,
      color: colors.primary
    });

    for (const panel of panels.slice(0, 10)) { // Limit to 10 panels
      const channel = interaction.guild.channels.cache.get(panel.channel_id);
      const channelName = channel ? `#${channel.name}` : 'Unknown Channel';
      const status = panel.enabled ? '🟢 Active' : '🔴 Disabled';
      const buttonCount = Array.isArray(panel.buttons) ? panel.buttons.length : 0;

      embed.addFields({
        name: `🎫 ${panel.title}`,
        value: `**ID:** \`${panel.id}\`\n` +
               `**Channel:** ${channelName}\n` +
               `**Status:** ${status}\n` +
               `**Buttons:** ${buttonCount}\n` +
               `**Created:** <t:${Math.floor(new Date(panel.created_at).getTime() / 1000)}:R>`,
        inline: true
      });
    }

    if (panels.length > 10) {
      embed.setFooter({ text: `... and ${panels.length - 10} more panels` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error listing ticket panels:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to retrieve ticket panels.')]
    });
  }
}

async function handleDeletePanel(interaction: CommandInteraction) {
  if (!interaction.guild) return;

  const panelId = interaction.options.getString('panel_id', true);

  await interaction.deferReply();

  try {
    const panel = await ticketHandler.getTicketPanel(panelId);
    
    if (!panel) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Ticket panel not found. Please check the panel ID.')]
      });
      return;
    }

    if (panel.guild_id !== interaction.guild.id) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'You can only delete panels from this server.')]
      });
      return;
    }

    const success = await ticketHandler.deleteTicketPanel(panelId);

    if (success) {
      // Try to delete the associated message
      try {
        const channel = interaction.guild.channels.cache.get(panel.channel_id);
        if (channel && 'messages' in channel && panel.message_id) {
          const message = await channel.messages.fetch(panel.message_id);
          if (message) {
            await message.delete();
          }
        }
      } catch (error) {
        // Message deletion failed, but panel was deleted
        console.warn('Failed to delete panel message:', error);
      }

      await interaction.editReply({
        embeds: [createSuccessEmbed(
          '✅ Panel Deleted',
          `Successfully deleted ticket panel "${panel.title}".`
        )]
      });
    } else {
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to delete ticket panel.')]
      });
    }
  } catch (error) {
    console.error('Error deleting ticket panel:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'An error occurred while deleting the ticket panel.')]
    });
  }
}