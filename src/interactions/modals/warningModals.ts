import { ModalSubmitInteraction } from 'discord.js';
import { warningService } from '../../services/warningService';
import { t } from '../../i18n';

export async function handleWarningModals(interaction: ModalSubmitInteraction) {
  const [action, ...params] = interaction.customId.split(':');

  if (action === 'warn_edit') {
    return handleWarnEdit(interaction, params[0]);
  } else if (interaction.customId === 'warn_automation_create') {
    return handleAutomationCreate(interaction);
  }
}

async function handleWarnEdit(interaction: ModalSubmitInteraction, warnId: string) {
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.fields.getTextInputValue('title');
  const description = interaction.fields.getTextInputValue('description');

  try {
    await warningService.editWarning(
      warnId,
      title,
      description || null,
      interaction.user
    );

    await interaction.editReply({
      content: t('commands.warn.subcommands.edit.success', { warnId }),
    });
  } catch (error) {
    console.error('Error editing warning:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}

async function handleAutomationCreate(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.fields.getTextInputValue('name');
  const description = interaction.fields.getTextInputValue('description');
  const triggerType = interaction.fields.getTextInputValue('triggerType') as 'warn_count' | 'warn_level';
  const triggerValue = parseInt(interaction.fields.getTextInputValue('triggerValue'));
  const actionsJson = interaction.fields.getTextInputValue('actions');

  // Validate trigger type
  if (!['warn_count', 'warn_level'].includes(triggerType)) {
    return interaction.editReply({
      content: 'Invalid trigger type. Must be "warn_count" or "warn_level"',
    });
  }

  // Validate trigger value
  if (isNaN(triggerValue) || triggerValue < 1) {
    return interaction.editReply({
      content: 'Invalid trigger value. Must be a positive number',
    });
  }

  // Parse actions JSON
  let actions;
  try {
    actions = JSON.parse(actionsJson);
    if (!Array.isArray(actions)) {
      throw new Error('Actions must be an array');
    }
  } catch (error) {
    return interaction.editReply({
      content: t('commands.warn.subcommands.automation.create.invalidJson'),
    });
  }

  try {
    const automation = await warningService.createAutomation(
      interaction.guild!,
      name,
      description || undefined,
      triggerType,
      triggerValue,
      actions,
      interaction.user
    );

    await interaction.editReply({
      content: t('commands.warn.subcommands.automation.create.success', { name: automation.name }),
    });
  } catch (error) {
    console.error('Error creating automation:', error);
    await interaction.editReply({
      content: t('common.error'),
    });
  }
}