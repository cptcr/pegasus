import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { Command } from '../../types/command';
import { TicketService } from '../../services/ticketService';
import { TicketRepository } from '../../repositories/ticketRepository';
import { t } from '../../i18n';
// import { GuildService } from '../../services/guildService';
import { CommandCategory } from '../../types/command';

export const ticket: Command = {
  category: CommandCategory.Tickets,
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage ticket system')
    .addSubcommandGroup(group =>
      group
        .setName('panel')
        .setDescription('Manage ticket panels')
        .addSubcommand(subcommand =>
          subcommand
            .setName('create')
            .setDescription('Create a new ticket panel configuration')
            .addStringOption(option =>
              option
                .setName('panel_id')
                .setDescription('Unique ID for this panel')
                .setRequired(true)
                .setMinLength(3)
                .setMaxLength(20)
            )
            .addStringOption(option =>
              option
                .setName('title')
                .setDescription('Panel title')
                .setRequired(true)
                .setMaxLength(256)
            )
            .addStringOption(option =>
              option
                .setName('description')
                .setDescription('Panel description')
                .setRequired(true)
                .setMaxLength(4096)
            )
            .addStringOption(option =>
              option
                .setName('button_label')
                .setDescription('Label for the create ticket button')
                .setMaxLength(80)
            )
            .addIntegerOption(option =>
              option
                .setName('button_style')
                .setDescription('Button style')
                .addChoices(
                  { name: 'Primary (Blue)', value: ButtonStyle.Primary },
                  { name: 'Secondary (Gray)', value: ButtonStyle.Secondary },
                  { name: 'Success (Green)', value: ButtonStyle.Success },
                  { name: 'Danger (Red)', value: ButtonStyle.Danger }
                )
            )
            .addChannelOption(option =>
              option
                .setName('category')
                .setDescription('Category to create tickets in')
                .addChannelTypes(ChannelType.GuildCategory)
            )
            .addRoleOption(option =>
              option.setName('support_role').setDescription('Support role that can see tickets')
            )
            .addIntegerOption(option =>
              option
                .setName('max_tickets')
                .setDescription('Maximum tickets per user')
                .setMinValue(1)
                .setMaxValue(10)
            )
            .addStringOption(option =>
              option
                .setName('welcome_message')
                .setDescription('Welcome message shown in new tickets')
                .setMaxLength(1024)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('load')
            .setDescription('Load and send a ticket panel')
            .addStringOption(option =>
              option.setName('panel_id').setDescription('ID of the panel to load').setRequired(true)
            )
            .addChannelOption(option =>
              option
                .setName('channel')
                .setDescription('Channel to send the panel to')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
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
        )
        .addSubcommand(subcommand =>
          subcommand.setName('list').setDescription('List all ticket panels in this server')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('edit')
            .setDescription('Edit an existing ticket panel')
            .addStringOption(option =>
              option.setName('panel_id').setDescription('ID of the panel to edit').setRequired(true)
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('claim').setDescription('Claim a ticket (for support staff)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close a ticket')
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for closing the ticket')
            .setMaxLength(1000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('stats').setDescription('View ticket statistics for this server')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const ticketService = new TicketService();
    const ticketRepository = new TicketRepository();
    const locale = 'en'; // Default to English for now

    try {
      if (subcommandGroup === 'panel') {
        switch (subcommand) {
          case 'create':
            await handlePanelCreate(interaction, ticketService, locale);
            break;
          case 'load':
            await handlePanelLoad(interaction, ticketService, locale);
            break;
          case 'delete':
            await handlePanelDelete(interaction, ticketService, locale);
            break;
          case 'list':
            await handlePanelList(interaction, ticketRepository, locale);
            break;
          case 'edit':
            await handlePanelEdit(interaction, ticketService, locale);
            break;
        }
      } else {
        switch (subcommand) {
          case 'claim':
            await handleClaim(interaction, ticketService, ticketRepository, locale);
            break;
          case 'close':
            await handleClose(interaction, ticketService, ticketRepository, locale);
            break;
          case 'stats':
            await handleStats(interaction, ticketRepository, locale);
            break;
        }
      }
    } catch (error: any) {
      await interaction.reply({
        content: t('common.error') + ': ' + error.message,
        ephemeral: true,
      });
    }
  },
};

async function handlePanelCreate(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  _locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const panelId = interaction.options.getString('panel_id', true);
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description', true);
  const buttonLabel = interaction.options.getString('button_label') || 'Create Ticket';
  const buttonStyle = interaction.options.getInteger('button_style') || ButtonStyle.Primary;
  const category = interaction.options.getChannel('category');
  const supportRole = interaction.options.getRole('support_role');
  const maxTickets = interaction.options.getInteger('max_tickets') || 1;
  const welcomeMessage = interaction.options.getString('welcome_message');

  // Collect additional options through components
  const embed = new EmbedBuilder()
    .setTitle(t('tickets.panelCreation'))
    .setDescription(t('tickets.configuringPanel', { id: panelId }))
    .addFields([
      { name: t('tickets.title'), value: title, inline: true },
      { name: t('tickets.buttonLabel'), value: buttonLabel, inline: true },
      { name: t('tickets.maxTicketsPerUser'), value: maxTickets.toString(), inline: true },
    ])
    .setColor(0x00ff00);

  const additionalRolesButton = new ButtonBuilder()
    .setCustomId('panel_add_roles')
    .setLabel(t('tickets.addMoreRoles'))
    .setStyle(ButtonStyle.Secondary);

  const setImageButton = new ButtonBuilder()
    .setCustomId('panel_set_image')
    .setLabel(t('tickets.setImage'))
    .setStyle(ButtonStyle.Secondary);

  const setFooterButton = new ButtonBuilder()
    .setCustomId('panel_set_footer')
    .setLabel(t('tickets.setFooter'))
    .setStyle(ButtonStyle.Secondary);

  const confirmButton = new ButtonBuilder()
    .setCustomId('panel_confirm')
    .setLabel(t('tickets.confirmCreate'))
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    additionalRolesButton,
    setImageButton,
    setFooterButton,
    confirmButton
  );

  // Store panel data temporarily
  const panelData = {
    panelId,
    title,
    description,
    buttonLabel,
    buttonStyle,
    categoryId: category?.id,
    supportRoles: supportRole ? [supportRole.id] : [],
    maxTicketsPerUser: maxTickets,
    welcomeMessage: welcomeMessage ?? undefined,
  };

  const message = await interaction.editReply({
    embeds: [embed],
    components: [row],
  });

  // Handle button interactions
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000, // 5 minutes
  });

  collector.on('collect', async buttonInteraction => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: t('common.notYourButton'),
        ephemeral: true,
      });
      return;
    }

    switch (buttonInteraction.customId) {
      case 'panel_confirm':
        try {
          await ticketService.createPanel(interaction.guild!, {
            ...panelData,
            guildId: interaction.guildId!,
          });

          const successEmbed = new EmbedBuilder()
            .setTitle(t('tickets.panelCreated'))
            .setDescription(t('tickets.panelCreatedDesc', { id: panelId }))
            .setColor(0x00ff00)
            .addFields([
              {
                name: t('tickets.nextStep'),
                value: t('tickets.useLoadCommand', { id: panelId }),
              },
            ]);

          await buttonInteraction.update({
            embeds: [successEmbed],
            components: [],
          });
          collector.stop();
        } catch (error: any) {
          await buttonInteraction.reply({
            content: t('common.error') + ': ' + error.message,
            ephemeral: true,
          });
        }
        break;

      // TODO: Implement additional configuration buttons
      default:
        await buttonInteraction.reply({
          content: t('common.featureNotImplemented'),
          ephemeral: true,
        });
    }
  });

  collector.on('end', () => {
    if (!collector.ended) {
      interaction.editReply({
        components: [],
      });
    }
  });
}

async function handlePanelLoad(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const panelId = interaction.options.getString('panel_id', true);
  const channel = interaction.options.getChannel('channel', true) as TextChannel;

  try {
    await ticketService.loadPanel(interaction.guild!, panelId, channel, locale);

    await interaction.editReply({
      content: t('tickets.panelLoaded', {
        id: panelId,
        channel: channel.toString(),
      }),
    });
  } catch (error: any) {
    await interaction.editReply({
      content: t('common.error', { error: error.message }),
    });
  }
}

async function handlePanelDelete(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  _locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const panelId = interaction.options.getString('panel_id', true);

  try {
    await ticketService.deletePanel(interaction.guild!, panelId);

    await interaction.editReply({
      content: t('tickets.panelDeleted', { id: panelId }),
    });
  } catch (error: any) {
    await interaction.editReply({
      content: t('common.error', { error: error.message }),
    });
  }
}

async function handlePanelList(
  interaction: ChatInputCommandInteraction,
  ticketRepository: TicketRepository,
  _locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const panels = await ticketRepository.getGuildPanels(interaction.guildId!);

  if (panels.length === 0) {
    await interaction.editReply({
      content: t('tickets.noPanels'),
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(t('tickets.panelList'))
    .setColor(0x5865f2)
    .setDescription(
      panels
        .map(
          panel =>
            `**${panel.panelId}**\n` +
            `${t('tickets.title')}: ${panel.title}\n` +
            `${t('tickets.status')}: ${panel.isActive ? '✅' : '❌'}\n` +
            `${t('tickets.created')}: <t:${Math.floor(panel.createdAt.getTime() / 1000)}:R>`
        )
        .join('\n\n')
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handlePanelEdit(
  interaction: ChatInputCommandInteraction,
  _ticketService: TicketService,
  _locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  // const panelId = interaction.options.getString('panel_id', true);

  // TODO: Implement panel editing with select menus and modals
  await interaction.editReply({
    content: t('common.featureNotImplemented'),
  });
}

async function handleClaim(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  ticketRepository: TicketRepository,
  locale: string
) {
  // Check if in ticket channel
  const ticket = await ticketRepository.getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({
      content: t('tickets.notInTicket'),
      ephemeral: true,
    });
    return;
  }

  try {
    await ticketService.claimTicket(ticket.id, interaction.member as any, locale);

    await interaction.reply({
      content: t('tickets.claimSuccess'),
    });
  } catch (error: any) {
    await interaction.reply({
      content: t('common.error', { error: error.message }),
      ephemeral: true,
    });
  }
}

async function handleClose(
  interaction: ChatInputCommandInteraction,
  ticketService: TicketService,
  ticketRepository: TicketRepository,
  locale: string
) {
  // Check if in ticket channel
  const ticket = await ticketRepository.getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({
      content: t('tickets.notInTicket'),
      ephemeral: true,
    });
    return;
  }

  const reason = interaction.options.getString('reason');

  try {
    await ticketService.closeTicket(
      ticket.id,
      interaction.member as any,
      reason || undefined,
      locale
    );

    await interaction.reply({
      content: t('tickets.closing'),
    });

    // Delete channel after 5 seconds
    setTimeout(async () => {
      try {
        await interaction.channel?.delete();
      } catch (error) {
        // Channel might already be deleted
      }
    }, 5000);
  } catch (error: any) {
    await interaction.reply({
      content: t('common.error', { error: error.message }),
      ephemeral: true,
    });
  }
}

async function handleStats(
  interaction: ChatInputCommandInteraction,
  ticketRepository: TicketRepository,
  _locale: string
) {
  await interaction.deferReply({ ephemeral: true });

  const stats = await ticketRepository.getTicketStats(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setTitle(t('tickets.statistics'))
    .setColor(0x5865f2)
    .addFields([
      {
        name: t('tickets.totalTickets'),
        value: stats.total.toString(),
        inline: true,
      },
      {
        name: t('tickets.openTickets'),
        value: stats.open.toString(),
        inline: true,
      },
      {
        name: t('tickets.claimedTickets'),
        value: stats.claimed.toString(),
        inline: true,
      },
      {
        name: t('tickets.closedTickets'),
        value: stats.closed.toString(),
        inline: true,
      },
      {
        name: t('tickets.lockedTickets'),
        value: stats.locked.toString(),
        inline: true,
      },
      {
        name: t('tickets.frozenTickets'),
        value: stats.frozen.toString(),
        inline: true,
      },
    ])
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// Export for command handler
export const data = ticket.data;
export const execute = ticket.execute;
