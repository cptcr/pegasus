import { ModalSubmitInteraction } from 'discord.js';
import { warningService } from '../../services/warningService';
import type { WarningAction } from '../../services/warningService';
import { t } from '../../i18n';

export async function handleWarningModals(interaction: ModalSubmitInteraction) {
  const [action, ...params] = interaction.customId.split(':');

  if (action === 'warn_edit') {
    return handleWarnEdit(interaction, params[0]);
  } else if (action === 'warn_automation_create') {
    const [triggerTypeParam, triggerValueParam] = params;
    return handleAutomationCreate(interaction, triggerTypeParam, triggerValueParam);
  }
}

async function handleWarnEdit(interaction: ModalSubmitInteraction, warnId: string) {
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.fields.getTextInputValue('title');
  const description = interaction.fields.getTextInputValue('description');

  try {
    await warningService.editWarning(warnId, title, description || null, interaction.user);

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

async function handleAutomationCreate(
  interaction: ModalSubmitInteraction,
  triggerTypeParam?: string,
  triggerValueParam?: string
) {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.fields.getTextInputValue('name');
  const description = getOptionalField(interaction, 'description');
  const actionInput = getOptionalField(interaction, 'action');
  const messageInput = getOptionalField(interaction, 'message');
  const legacyActionsJson = getOptionalField(interaction, 'actions');

  let triggerType = parseTriggerType(triggerTypeParam);
  if (!triggerType) {
    const fallbackTrigger = getOptionalField(interaction, 'triggerType');
    triggerType = parseTriggerType(fallbackTrigger);
  }

  let triggerValue = parseTriggerValue(triggerValueParam);
  if (triggerValue === undefined) {
    const fallbackTriggerValue = getOptionalField(interaction, 'triggerValue');
    triggerValue = parseTriggerValue(fallbackTriggerValue);
  }

  if (
    !triggerType ||
    triggerValue === undefined ||
    Number.isNaN(triggerValue) ||
    triggerValue < 1
  ) {
    await interaction.editReply({
      content: t('commands.warn.subcommands.automation.create.missingTrigger'),
    });
    return;
  }

  let actions: WarningAction[] | null = null;

  if (actionInput) {
    const result = mapAutomationAction(actionInput, messageInput);
    if (!result.success) {
      await interaction.editReply({ content: result.error });
      return;
    }
    actions = result.actions;
  } else if (legacyActionsJson) {
    try {
      const parsed = JSON.parse(legacyActionsJson);
      if (!Array.isArray(parsed)) {
        throw new Error('Actions must be an array');
      }
      actions = parsed;
    } catch {
      await interaction.editReply({
        content: t('commands.warn.subcommands.automation.create.invalidJson'),
      });
      return;
    }
  }

  if (!actions || actions.length === 0) {
    await interaction.editReply({
      content: t('commands.warn.subcommands.automation.create.invalidAction'),
    });
    return;
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

function getOptionalField(interaction: ModalSubmitInteraction, fieldId: string) {
  try {
    return interaction.fields.getTextInputValue(fieldId);
  } catch {
    return undefined;
  }
}

const parseTriggerType = (value?: string): 'warn_count' | 'warn_level' | undefined => {
  if (!value) {
    return undefined;
  }

  return value === 'warn_count' || value === 'warn_level' ? value : undefined;
};

const parseTriggerValue = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const ACTION_CONFIG: Record<
  string,
  { type: 'ban' | 'kick' | 'timeout' | 'message'; duration?: number }
> = {
  '1d timeout': { type: 'timeout', duration: 60 * 24 },
  '1d timeoute': { type: 'timeout', duration: 60 * 24 },
  '1w timeout': { type: 'timeout', duration: 60 * 24 * 7 },
  '1w timeoute': { type: 'timeout', duration: 60 * 24 * 7 },
  kick: { type: 'kick' },
  ban: { type: 'ban' },
  sendmessageonly: { type: 'message' },
  'send message only': { type: 'message' },
  message: { type: 'message' },
};

const normalizeActionChoice = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const mapAutomationAction = (
  actionRaw: string,
  messageRaw?: string
): { success: true; actions: WarningAction[] } | { success: false; error: string } => {
  const normalizedAction = normalizeActionChoice(actionRaw);
  const config = ACTION_CONFIG[normalizedAction];

  if (!config) {
    return {
      success: false,
      error: t('commands.warn.subcommands.automation.create.invalidAction'),
    };
  }

  const trimmedMessage = messageRaw?.trim();

  if (config.type === 'message') {
    if (!trimmedMessage) {
      return {
        success: false,
        error: t('commands.warn.subcommands.automation.create.messageRequired'),
      };
    }

    return {
      success: true,
      actions: [{ type: 'message', message: trimmedMessage }],
    };
  }

  const actions: WarningAction[] = [];

  if (config.type === 'timeout' && config.duration) {
    actions.push({ type: 'timeout', duration: config.duration });
  } else {
    actions.push({ type: config.type });
  }

  if (trimmedMessage) {
    actions.push({ type: 'message', message: trimmedMessage });
  }

  return { success: true, actions };
};
