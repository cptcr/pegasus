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
  AttachmentBuilder,
} from 'discord.js';
import { CommandCategory } from '../../types/command';
import { t } from '../../i18n';
import { warningService } from '../../services/warningService';
import { warningRepository } from '../../repositories/warningRepository';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription(t('commands.warn.description'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription(t('commands.warn.subcommands.create.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.warn.subcommands.create.options.user'))
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('title')
          .setDescription(t('commands.warn.subcommands.create.options.title'))
          .setRequired(true)
          .setMaxLength(255)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription(t('commands.warn.subcommands.create.options.description'))
          .setRequired(false)
          .setMaxLength(1000)
      )
      .addIntegerOption(option =>
        option
          .setName('level')
          .setDescription(t('commands.warn.subcommands.create.options.level'))
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10)
      )
      .addAttachmentOption(option =>
        option
          .setName('proof')
          .setDescription(t('commands.warn.subcommands.create.options.proof'))
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription(t('commands.warn.subcommands.edit.description'))
      .addStringOption(option =>
        option
          .setName('warnid')
          .setDescription(t('commands.warn.subcommands.edit.options.warnid'))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('lookup')
      .setDescription(t('commands.warn.subcommands.lookup.description'))
      .addStringOption(option =>
        option
          .setName('warnid')
          .setDescription(t('commands.warn.subcommands.lookup.options.warnid'))
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription(t('commands.warn.subcommands.view.description'))
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription(t('commands.warn.subcommands.view.options.user'))
          .setRequired(true)
      )
  )
  .addSubcommandGroup(group =>
    group
      .setName('automation')
      .setDescription('Manage warning automations')
      .addSubcommand(subcommand =>
        subcommand
          .setName('create')
          .setDescription(t('commands.warn.subcommands.automation.create.description'))
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('view')
          .setDescription(t('commands.warn.subcommands.automation.view.description'))
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('delete')
          .setDescription(t('commands.warn.subcommands.automation.delete.description'))
          .addStringOption(option =>
            option
              .setName('automationid')
              .setDescription(t('commands.warn.subcommands.automation.delete.options.automationid'))
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
    case 'view':
      return handleWarnView(interaction);
    default:
      // Show help embed with all available commands
      return handleWarnHelp(interaction);
  }
}

async function handleWarnHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
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

async function handleWarnCreate(interaction: ChatInputCommandInteraction) {
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
      .setColor(0xFFA500)
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
        .setColor(0xFFA500)
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
    console.error('Error creating warning:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleWarnEdit(interaction: ChatInputCommandInteraction) {
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
  const descriptionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descriptionInput);

  modal.addComponents(titleRow, descriptionRow);

  await interaction.showModal(modal);
}

async function handleWarnLookup(interaction: ChatInputCommandInteraction) {
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

async function handleWarnView(interaction: ChatInputCommandInteraction) {
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
    .setColor(0xFFA500)
    .setTitle(t('commands.warn.subcommands.view.title', { user: user.tag }))
    .setDescription(t('commands.warn.subcommands.view.stats', { 
      count: stats.count, 
      level: stats.totalLevel 
    }))
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

async function handleAutomationCreate(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('warn_automation_create')
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

  const triggerTypeInput = new TextInputBuilder()
    .setCustomId('triggerType')
    .setLabel(t('commands.warn.subcommands.automation.create.modal.triggerType'))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('warn_count or warn_level');

  const triggerValueInput = new TextInputBuilder()
    .setCustomId('triggerValue')
    .setLabel(t('commands.warn.subcommands.automation.create.modal.triggerValue'))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('5');

  const actionsInput = new TextInputBuilder()
    .setCustomId('actions')
    .setLabel(t('commands.warn.subcommands.automation.create.modal.actions'))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder('[{"type":"ban"},{"type":"message","message":"You have been banned"}]');

  const rows = [
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descriptionInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(triggerTypeInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(triggerValueInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(actionsInput),
  ];

  modal.addComponents(...rows);
  await interaction.showModal(modal);
}

async function handleAutomationView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const automations = await warningRepository.getGuildAutomations(interaction.guild!.id);

  if (automations.length === 0) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.automation.view.noAutomations'),
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(t('commands.warn.subcommands.automation.view.title'))
    .setTimestamp();

  for (const automation of automations) {
    const triggerText = `${automation.triggerType === 'warn_count' ? 'Count' : 'Level'} >= ${automation.triggerValue}`;
    const actionsText = (automation.actions as any[]).map(a => a.type).join(', ');
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
      ].filter(Boolean).join('\n'),
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleAutomationDelete(interaction: ChatInputCommandInteraction) {
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