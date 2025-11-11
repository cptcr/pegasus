import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalActionRowComponentBuilder,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { warningService } from '../../services/warningService';
import type { WarningAction } from '../../services/warningService';
import { warningRepository } from '../../repositories/warningRepository';
import {
  createLocalizationMap,
  commandDescriptions,
  subcommandDescriptions,
  optionDescriptions,
} from '../../utils/localization';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Manage user warnings')
  .setDescriptionLocalizations(createLocalizationMap(commandDescriptions.warn))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Issue a warning to a user')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.create))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to warn')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('title')
          .setDescription('Title of the warning')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.title))
          .setRequired(true)
          .setMaxLength(255)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Description of the warning')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.description))
          .setRequired(false)
          .setMaxLength(1000)
      )
      .addIntegerOption(option =>
        option
          .setName('level')
          .setDescription('Warning level (1-10)')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.level))
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10)
      )
      .addAttachmentOption(option =>
        option
          .setName('proof')
          .setDescription('Proof attachment')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.proof))
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing warning')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.edit))
      .addStringOption(option =>
        option
          .setName('warnid')
          .setDescription('The warning ID to edit')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.warnid))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('lookup')
      .setDescription('Look up a specific warning')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.lookup))
      .addStringOption(option =>
        option
          .setName('warnid')
          .setDescription('The warning ID to look up')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.warnid))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a warning by ID')
      .setDescriptionLocalizations({
        'de': 'Eine Warnung anhand der ID löschen',
        'es-ES': 'Eliminar una advertencia por ID',
        fr: 'Supprimer un avertissement par identifiant',
      })
      .addStringOption(option =>
        option
          .setName('warnid')
          .setDescription('The warning ID to delete')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.warnid))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View all warnings for a user')
      .setDescriptionLocalizations(createLocalizationMap(subcommandDescriptions.warn.view))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to view warnings for')
          .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.user))
          .setRequired(true)
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('automation')
      .setDescription('Manage warning automations')
      .setDescriptionLocalizations({
        de: 'Warnungsautomatisierungen verwalten',
        'es-ES': 'Gestionar automatizaciones de advertencia',
        fr: "Gérer les automatisations d'avertissement",
      })
      .addSubcommand(subcommand =>
        subcommand
          .setName('create')
          .setDescription('Create a warning automation')
          .setDescriptionLocalizations(
            createLocalizationMap(subcommandDescriptions.warn.automation.create)
          )
          .addStringOption(option =>
            option
              .setName('trigger_type')
              .setDescription('When this automation should trigger')
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.triggerType))
              .setRequired(true)
              .addChoices(
                { name: 'Warn Count', value: 'warn_count' },
                { name: 'Warn Level', value: 'warn_level' }
              )
          )
          .addIntegerOption(option =>
            option
              .setName('trigger_value')
              .setDescription('Threshold that triggers the automation')
              .setDescriptionLocalizations(createLocalizationMap(optionDescriptions.triggerValue))
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(100)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('view')
          .setDescription('View all warning automations')
          .setDescriptionLocalizations(
            createLocalizationMap(subcommandDescriptions.warn.automation.view)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('delete')
          .setDescription('Delete a warning automation')
          .setDescriptionLocalizations(
            createLocalizationMap(subcommandDescriptions.warn.automation.delete)
          )
          .addStringOption(option =>
            option
              .setName('automationid')
              .setDescription('The automation ID to delete')
              .setDescriptionLocalizations({
                de: 'Die zu löschende Automatisierungs-ID',
                'es-ES': 'El ID de automatización a eliminar',
                fr: "L'ID d'automatisation à supprimer",
              })
              .setRequired(true)
          )
      )
  );

export const category = CommandCategory.Moderation;
export const cooldown = 3;
export const permissions = [PermissionFlagsBits.ModerateMembers];

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: t('common.guildOnly'),
      ephemeral: true,
    });
  }

  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  // Handle automation subcommands
  if (subcommandGroup === 'automation') {
    switch (subcommand) {
      case 'create':
        return handleAutomationCreate(interaction);
      case 'view':
        return handleAutomationView(interaction);
      case 'delete':
        return handleAutomationDelete(interaction);
    }
    return;
  }

  // Handle main warn subcommands
  switch (subcommand) {
    case 'create':
      return handleWarnCreate(interaction);
    case 'edit':
      return handleWarnEdit(interaction);
    case 'lookup':
      return handleWarnLookup(interaction);
    case 'delete':
      return handleWarnDelete(interaction);
    case 'view':
      return handleWarnView(interaction);
    default:
      // Show help embed with all available commands
      return handleWarnHelp(interaction);
  }
}

async function handleWarnHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('Warning System Commands')
    .setDescription('Available warning commands:')
    .addFields(
      {
        name: '/warn create',
        value: 'Warn a user with title, description, level, and proof',
        inline: false,
      },
      {
        name: '/warn edit',
        value: 'Edit an existing warning',
        inline: false,
      },
      {
        name: '/warn lookup',
        value: 'Lookup a specific warning by ID',
        inline: false,
      },
      {
        name: '/warn delete',
        value: 'Delete a warning by ID',
        inline: false,
      },
      {
        name: '/warn view',
        value: 'View all warnings for a user',
        inline: false,
      },
      {
        name: '/warn automation create',
        value: 'Create an automation for warning thresholds',
        inline: false,
      },
      {
        name: '/warn automation view',
        value: 'View all configured automations',
        inline: false,
      },
      {
        name: '/warn automation delete',
        value: 'Delete an automation',
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleWarnCreate(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description');
  const level = interaction.options.getInteger('level') || 1;
  const proof = interaction.options.getAttachment('proof');

  // Check if user is trying to warn themselves
  if (user.id === interaction.user.id) {
    return interaction.editReply({
      content: 'You cannot warn yourself!',
    });
  }

  // Check if user is trying to warn a bot
  if (user.bot) {
    return interaction.editReply({
      content: 'You cannot warn bots!',
    });
  }

  try {
    const warning = await warningService.createWarning(
      interaction.guild!,
      user,
      interaction.user,
      title,
      description || undefined,
      level,
      proof?.url
    );

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle(t('commands.warn.subcommands.create.embed.title'))
      .setDescription(t('commands.warn.subcommands.create.success', { user: user.tag }))
      .addFields(
        {
          name: t('commands.warn.subcommands.create.embed.warnId'),
          value: warning.warnId,
          inline: true,
        },
        {
          name: t('commands.warn.subcommands.create.embed.level'),
          value: level.toString(),
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Try to DM the user
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('You have been warned')
        .setDescription(`You have been warned in **${interaction.guild!.name}**`)
        .addFields(
          {
            name: 'Title',
            value: title,
            inline: false,
          },
          {
            name: 'Description',
            value: description || 'No description provided',
            inline: false,
          },
          {
            name: 'Level',
            value: level.toString(),
            inline: true,
          }
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      // User has DMs disabled
    }
  } catch (error) {
    logger.error('Error creating warning:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleWarnEdit(interaction: ChatInputCommandInteraction): Promise<any> {
  const warnId = interaction.options.getString('warnid', true);

  // Get the warning
  const warning = await warningRepository.getWarningById(warnId);
  if (!warning || warning.guildId !== interaction.guild!.id) {
    return interaction.reply({
      content: t('commands.warn.subcommands.edit.notFound'),
      ephemeral: true,
    });
  }

  // Create modal
  const modal = new ModalBuilder()
    .setCustomId(`warn_edit:${warnId}`)
    .setTitle(t('commands.warn.subcommands.edit.modal.title'));

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel(t('commands.warn.subcommands.edit.modal.titleField'))
    .setStyle(TextInputStyle.Short)
    .setValue(warning.title)
    .setRequired(true)
    .setMaxLength(255);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel(t('commands.warn.subcommands.edit.modal.descriptionField'))
    .setStyle(TextInputStyle.Paragraph)
    .setValue(warning.description || '')
    .setRequired(false)
    .setMaxLength(1000);

  const titleRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(titleInput);
  const descriptionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
    descriptionInput
  );

  modal.addComponents(titleRow, descriptionRow);

  await interaction.showModal(modal);
}

async function handleWarnLookup(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const warnId = interaction.options.getString('warnid', true);

  const warning = await warningRepository.getWarningById(warnId);
  if (!warning || warning.guildId !== interaction.guild!.id) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.lookup.notFound', { warnId }),
    });
  }

  const embed = await warningService.getWarningEmbed(warning, interaction.guild!);
  await interaction.editReply({ embeds: [embed] });
}

async function handleWarnDelete(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply({ ephemeral: true });

  const warnId = interaction.options.getString('warnid', true);

  try {
    const deleted = await warningService.deleteWarning(warnId, interaction.user);

    if (!deleted) {
      await interaction.editReply({
        content: t('commands.warn.subcommands.delete.notFound', { warnId }),
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(t('commands.warn.subcommands.delete.success.title'))
      .setDescription(t('commands.warn.subcommands.delete.success.description', { warnId }))
      .addFields(
        {
          name: t('commands.warn.subcommands.delete.success.target'),
          value: `<@${deleted.userId}>`,
          inline: true,
        },
        {
          name: t('commands.warn.subcommands.delete.success.moderator'),
          value: interaction.user.tag,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error deleting warning:', error);
    await interaction.editReply({
      content: t('commands.warn.subcommands.delete.error'),
    });
  }
}

async function handleWarnView(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const user = interaction.options.getUser('user', true);
  const warnings = await warningRepository.getUserWarnings(interaction.guild!.id, user.id);
  const stats = await warningRepository.getUserWarningStats(interaction.guild!.id, user.id);

  if (warnings.length === 0) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.view.noWarnings', { user: user.tag }),
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle(t('commands.warn.subcommands.view.title', { user: user.tag }))
    .setDescription(
      t('commands.warn.subcommands.view.stats', {
        count: stats.count,
        level: stats.totalLevel,
      })
    )
    .setTimestamp();

  // Add warning fields (max 10)
  const warningsToShow = warnings.slice(0, 10);
  for (const warning of warningsToShow) {
    embed.addFields({
      name: `${warning.warnId} - Level ${warning.level}`,
      value: `**${warning.title}**\n${warning.description || 'No description'}\n<t:${Math.floor(warning.createdAt.getTime() / 1000)}:R>`,
      inline: false,
    });
  }

  if (warnings.length > 10) {
    embed.setFooter({
      text: `Showing 10 of ${warnings.length} warnings`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleAutomationCreate(interaction: ChatInputCommandInteraction): Promise<any> {
  const triggerType = interaction.options.getString('trigger_type', true) as
    | 'warn_count'
    | 'warn_level';
  const triggerValue = interaction.options.getInteger('trigger_value', true);

  const modal = new ModalBuilder()
    .setCustomId(`warn_automation_create:${triggerType}:${triggerValue}`)
    .setTitle(t('commands.warn.subcommands.automation.create.modal.title'));

  const nameInput = new TextInputBuilder()
    .setCustomId('name')
    .setLabel(t('commands.warn.subcommands.automation.create.modal.name'))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(255);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel(t('commands.warn.subcommands.automation.create.modal.description'))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  const actionInput = new TextInputBuilder()
    .setCustomId('action')
    .setLabel(t('commands.warn.subcommands.automation.create.modal.action'))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('1d Timeout, 1w Timeout, kick, ban, sendMessageOnly');

  const messageInput = new TextInputBuilder()
    .setCustomId('message')
    .setLabel(t('commands.warn.subcommands.automation.create.modal.message'))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000)
    .setPlaceholder('Optional message sent to the user when this triggers');

  const rows = [
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descriptionInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(actionInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(messageInput),
  ];

  modal.addComponents(...rows);
  await interaction.showModal(modal);
}

async function handleAutomationView(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const automations = await warningRepository.getGuildAutomations(interaction.guild!.id);

  if (automations.length === 0) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.automation.view.noAutomations'),
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(t('commands.warn.subcommands.automation.view.title'))
    .setTimestamp();

  for (const automation of automations) {
    const triggerText = `${automation.triggerType === 'warn_count' ? 'Count' : 'Level'} >= ${automation.triggerValue}`;
    const actionsText = (automation.actions as WarningAction[])
      .map(action => formatAutomationAction(action))
      .join(', ');
    const statusText = automation.enabled ? t('common.enabled') : t('common.disabled');
    const lastTriggered = automation.lastTriggeredAt
      ? `<t:${Math.floor(automation.lastTriggeredAt.getTime() / 1000)}:R>`
      : t('common.none');

    embed.addFields({
      name: `${automation.name} (${automation.automationId})`,
      value: [
        `**${t('commands.warn.subcommands.automation.view.fields.trigger')}:** ${triggerText}`,
        `**${t('commands.warn.subcommands.automation.view.fields.actions')}:** ${actionsText}`,
        `**${t('commands.warn.subcommands.automation.view.fields.status')}:** ${statusText}`,
        `**${t('commands.warn.subcommands.automation.view.fields.lastTriggered')}:** ${lastTriggered}`,
        automation.description ? `\n${automation.description}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleAutomationDelete(interaction: ChatInputCommandInteraction): Promise<any> {
  await interaction.deferReply();

  const automationId = interaction.options.getString('automationid', true);

  const deleted = await warningService.deleteAutomation(automationId, interaction.user);

  if (!deleted) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.automation.delete.notFound'),
    });
  }

  await interaction.editReply({
    content: t('commands.warn.subcommands.automation.delete.success', { automationId }),
  });
}

function formatAutomationAction(action: WarningAction): string {
  switch (action.type) {
    case 'ban':
      return 'Ban';
    case 'kick':
      return 'Kick';
    case 'timeout':
      return action.duration ? `Timeout (${formatAutomationDuration(action.duration)})` : 'Timeout';
    case 'mute':
      return action.duration ? `Mute (${formatAutomationDuration(action.duration)})` : 'Mute';
    case 'message':
      return 'Send Message';
    case 'role':
      return 'Role Action';
    default:
      return action.type;
  }
}

function formatAutomationDuration(minutes?: number): string {
  if (!minutes || Number.isNaN(minutes)) {
    return 'N/A';
  }

  if (minutes % (60 * 24 * 7) === 0) {
    const weeks = minutes / (60 * 24 * 7);
    return `${weeks}w`;
  }

  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return `${days}d`;
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }

  return `${minutes}m`;
}
