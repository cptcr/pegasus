import { ButtonInteraction, EmbedBuilder, PermissionFlagsBits, type GuildMember } from 'discord.js';
import { t } from '../../i18n';
import { logger } from '../../utils/logger';
import { wordFilterService } from '../../services/wordFilterService';
import { warningService } from '../../services/warningService';
import type { WordFilterRule, WordFilterActionType } from '../../types';

export async function handleWordFilterActionButtons(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('|');

  if (parts[0] !== 'filter_action') {
    return;
  }

  const actionType = parts[1] as WordFilterActionType | 'dismiss';
  const targetUserId = parts[2];
  const ruleId = Number(parts[3]);
  const durationSeconds = Number(parts[4] ?? '0');

  if (!interaction.guild) {
    await interaction.reply({
      content: t('common.guildOnly'),
      ephemeral: true,
    });
    return;
  }

  if (!targetUserId) {
    await interaction.reply({
      content: t('modLogs.filter.actions.invalidTarget'),
      ephemeral: true,
    });
    return;
  }

  if (actionType === 'dismiss') {
    await interaction.deferUpdate();
    await appendResolution(
      interaction,
      t('modLogs.filter.actions.resolvedDismiss', {
        moderator: interaction.user.tag,
      })
    );
    return;
  }

  const rule = Number.isFinite(ruleId)
    ? await wordFilterService.getRule(interaction.guildId!, ruleId)
    : null;

  if (!rule) {
    await interaction.reply({
      content: t('modLogs.filter.actions.ruleMissing'),
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    switch (actionType) {
      case 'warn':
        await handleWarn(interaction, targetUserId, rule);
        break;
      case 'timeout':
        await handleTimeout(interaction, targetUserId, rule, durationSeconds);
        break;
      case 'kick':
        await handleKick(interaction, targetUserId, rule);
        break;
      case 'ban':
        await handleBan(interaction, targetUserId, rule);
        break;
      default:
        await interaction.editReply({
          content: t('modLogs.filter.actions.unsupported'),
        });
        return;
    }

    await appendResolution(
      interaction,
      t(`modLogs.filter.actions.resolved.${actionType}`, {
        moderator: interaction.user.tag,
        duration: formatDuration(durationSeconds),
      })
    );
  } catch (error) {
    logger.error(`Failed to execute filter action ${actionType}:`, error);
    await interaction.editReply({
      content: t('modLogs.filter.actions.failed'),
    });
  }
}

async function handleWarn(
  interaction: ButtonInteraction,
  targetUserId: string,
  rule: WordFilterRule
) {
  const guild = interaction.guild!;
  const user = await interaction.client.users.fetch(targetUserId).catch(() => null);

  if (!user) {
    await interaction.editReply({
      content: t('modLogs.filter.actions.userNotFound'),
    });
    return;
  }

  const reason = t('modLogs.filter.actions.warnReason', {
    pattern: rule.pattern,
    severity: t(`modLogs.filter.severity.${rule.severity}`),
  });

  await warningService.createWarning(
    guild,
    user,
    interaction.user,
    t('modLogs.filter.actions.warnTitle'),
    reason,
    1
  );

  await interaction.editReply({
    content: t('modLogs.filter.actions.warnSuccess', {
      user: user.tag,
    }),
  });
}

async function handleTimeout(
  interaction: ButtonInteraction,
  targetUserId: string,
  rule: WordFilterRule,
  durationSeconds: number
) {
  const guild = interaction.guild!;
  const member = await guild.members.fetch(targetUserId).catch(() => null);

  if (!member) {
    await interaction.editReply({
      content: t('modLogs.filter.actions.memberNotFound'),
    });
    return;
  }

  if (
    !(await ensureModerationPermissions(interaction, member, PermissionFlagsBits.ModerateMembers))
  ) {
    return;
  }

  const duration = durationSeconds > 0 ? durationSeconds : 600;

  await member.timeout(
    duration * 1000,
    t('modLogs.filter.actions.timeoutReason', {
      pattern: rule.pattern,
    })
  );

  await interaction.editReply({
    content: t('modLogs.filter.actions.timeoutSuccess', {
      user: member.user.tag,
      duration: formatDuration(duration),
    }),
  });
}

async function handleKick(
  interaction: ButtonInteraction,
  targetUserId: string,
  rule: WordFilterRule
) {
  const guild = interaction.guild!;
  const member = await guild.members.fetch(targetUserId).catch(() => null);

  if (!member) {
    await interaction.editReply({
      content: t('modLogs.filter.actions.memberNotFound'),
    });
    return;
  }

  if (!(await ensureModerationPermissions(interaction, member, PermissionFlagsBits.KickMembers))) {
    return;
  }

  await member.kick(t('modLogs.filter.actions.kickReason', { pattern: rule.pattern }));

  await interaction.editReply({
    content: t('modLogs.filter.actions.kickSuccess', {
      user: member.user.tag,
    }),
  });
}

async function handleBan(
  interaction: ButtonInteraction,
  targetUserId: string,
  rule: WordFilterRule
) {
  const guild = interaction.guild!;

  if (
    !(await ensureModerationPermissions(
      interaction,
      await guild.members.fetch(targetUserId).catch(() => null),
      PermissionFlagsBits.BanMembers
    ))
  ) {
    return;
  }

  await guild.bans.create(targetUserId, {
    reason: t('modLogs.filter.actions.banReason', { pattern: rule.pattern }),
  });

  const user = await interaction.client.users.fetch(targetUserId).catch(() => null);

  await interaction.editReply({
    content: t('modLogs.filter.actions.banSuccess', {
      user: user?.tag ?? targetUserId,
    }),
  });
}

async function ensureModerationPermissions(
  interaction: ButtonInteraction,
  targetMember: GuildMember | null,
  requiredPermission: bigint
): Promise<boolean> {
  if (!interaction.memberPermissions?.has(requiredPermission)) {
    await interaction.editReply({
      content: t('modLogs.filter.actions.missingPermission'),
    });
    return false;
  }

  if (!targetMember) {
    await interaction.editReply({
      content: t('modLogs.filter.actions.memberNotFound'),
    });
    return false;
  }

  const executorMember = await interaction
    .guild!.members.fetch(interaction.user.id)
    .catch(() => null);
  const botMember = interaction.guild!.members.me;

  if (botMember && targetMember.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
    await interaction.editReply({
      content: t('modLogs.filter.actions.botHierarchy'),
    });
    return false;
  }

  if (
    executorMember &&
    targetMember.roles.highest.comparePositionTo(executorMember.roles.highest) >= 0
  ) {
    await interaction.editReply({
      content: t('modLogs.filter.actions.hierarchy'),
    });
    return false;
  }

  return true;
}

async function appendResolution(interaction: ButtonInteraction, resolution: string) {
  const message = interaction.message;
  const embed = message.embeds[0];

  if (!embed) return;

  const builder = EmbedBuilder.from(embed);
  const description = embed.description ?? '';
  const newDescription = `${description}\n\n${resolution}`.trim();
  builder.setDescription(newDescription);

  await message.edit({
    embeds: [builder],
    components: [],
  });
}

function formatDuration(durationSeconds: number): string {
  if (durationSeconds <= 0) return t('modLogs.filter.actions.durationMinutes', { count: 10 });

  if (durationSeconds < 60) {
    return t('modLogs.filter.actions.durationSeconds', { count: durationSeconds });
  }

  if (durationSeconds < 3600) {
    const minutes = Math.round(durationSeconds / 60);
    return t('modLogs.filter.actions.durationMinutes', { count: minutes });
  }

  const hours = Math.round(durationSeconds / 3600);
  return t('modLogs.filter.actions.durationHours', { count: hours });
}
