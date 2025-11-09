import { ButtonInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { warningRepository } from '../../repositories/warningRepository';
import { t } from '../../i18n';

export async function handleWarningActionButtons(interaction: ButtonInteraction) {
  const [prefix, action, ...params] = interaction.customId.split(':');

  if (prefix === 'warn_action') {
    return handleWarningAction(interaction, action, params);
  } else if (prefix === 'warn_view') {
    return handleWarningView(interaction, params[0]);
  }
}

async function handleWarningAction(
  interaction: ButtonInteraction,
  action: string,
  params: string[]
) {
  // Check permissions
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({
      content: t('common.noPermission'),
      ephemeral: true,
    });
    return;
  }

  const userId = params[0];
  const member = await interaction.guild!.members.fetch(userId).catch(() => null);

  if (!member) {
    await interaction.reply({
      content: 'Member not found in this server',
      ephemeral: true,
    });
    return;
  }

  // Check role hierarchy
  const botMember = interaction.guild!.members.me!;
  const executorMember = interaction.member as any;

  if (member.roles.highest.position >= botMember.roles.highest.position) {
    await interaction.reply({
      content: 'I cannot moderate this member due to role hierarchy',
      ephemeral: true,
    });
    return;
  }

  if (member.roles.highest.position >= executorMember.roles.highest.position) {
    await interaction.reply({
      content: 'You cannot moderate this member due to role hierarchy',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    switch (action) {
      case 'ban':
        await member.ban({ reason: 'Warning threshold reached' });
        await interaction.editReply({
          content: `Successfully banned ${member.user.tag}`,
        });
        break;

      case 'kick':
        await member.kick('Warning threshold reached');
        await interaction.editReply({
          content: `Successfully kicked ${member.user.tag}`,
        });
        break;

      case 'timeout': {
        const durationMinutes = parseInt(params[1]) || 60;
        const durationMs = durationMinutes * 60 * 1000;

        if (!member.moderatable) {
          await interaction.editReply({
            content: 'I cannot timeout this member.',
          });
          return;
        }

        await member.timeout(durationMs, 'Warning threshold reached');

        await interaction.editReply({
          content: `Timed out ${member.user.tag} for ${formatActionDuration(durationMinutes)}`,
        });
        break;
      }

      case 'mute':
        const duration = parseInt(params[1]) || 60; // Default 60 minutes
        const muteRole = interaction.guild!.roles.cache.find(r => r.name.toLowerCase() === 'muted');

        if (!muteRole) {
          await interaction.editReply({
            content: 'Mute role not found. Please create a role named "Muted"',
          });
          return;
        }

        await member.roles.add(muteRole, 'Warning threshold reached');

        // Schedule unmute
        setTimeout(
          async () => {
            try {
              await member.roles.remove(muteRole);
            } catch (error) {
              // Member might have left or role might be deleted
            }
          },
          duration * 60 * 1000
        );

        await interaction.editReply({
          content: `Successfully muted ${member.user.tag} for ${duration} minutes`,
        });
        break;

      default:
        await interaction.editReply({
          content: 'Unknown action',
        });
        return;
    }

    // Update the original message to show action taken
    const message = interaction.message;
    const embed = message.embeds[0];

    if (embed) {
      const updatedEmbed = EmbedBuilder.from(embed).addFields({
        name: 'Action Taken',
        value: `${action.charAt(0).toUpperCase() + action.slice(1)} by ${interaction.user.tag}`,
        inline: false,
      });

      await message.edit({ embeds: [updatedEmbed], components: [] });
    }
  } catch (error) {
    console.error('Error executing warning action:', error);
    await interaction.editReply({
      content: 'Failed to execute action',
    });
  }
}

const formatActionDuration = (minutes: number) => {
  if (!minutes || Number.isNaN(minutes)) {
    return 'unknown duration';
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
};

async function handleWarningView(interaction: ButtonInteraction, userId: string) {
  await interaction.deferReply({ ephemeral: true });

  const warnings = await warningRepository.getUserWarnings(interaction.guild!.id, userId);
  const stats = await warningRepository.getUserWarningStats(interaction.guild!.id, userId);
  const user = await interaction.client.users.fetch(userId).catch(() => null);

  if (warnings.length === 0) {
    await interaction.editReply({
      content: t('commands.warn.subcommands.view.noWarnings', { user: user?.tag || userId }),
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle(t('commands.warn.subcommands.view.title', { user: user?.tag || userId }))
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
