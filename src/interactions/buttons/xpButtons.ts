import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { xpService } from '../../services/xpService';
import { logger } from '../../utils/logger';
import { getTranslation } from '../../i18n';

export async function handleXPButtons(interaction: ButtonInteraction): Promise<void> {
  const [action, type, ...params] = interaction.customId.split('_');
  
  if (action !== 'xp') return;

  const locale = await getTranslation(interaction.guildId!, interaction.user.id);

  switch (type) {
    case 'leaderboard':
      await handleLeaderboardNavigation(interaction, params, locale);
      break;
  }
}

async function handleLeaderboardNavigation(
  interaction: ButtonInteraction,
  params: string[],
  locale: any
): Promise<void> {
  try {
    const [direction, currentPageStr] = params;
    const currentPage = parseInt(currentPageStr, 10);
    
    if (isNaN(currentPage)) {
      await interaction.reply({
        content: locale.common.error,
        ephemeral: true,
      });
      return;
    }

    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    if (newPage < 1) {
      await interaction.reply({
        content: locale.common.error,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    const leaderboardData = await xpService.getLeaderboard(interaction.guildId!, newPage, 10);

    if (leaderboardData.entries.length === 0) {
      await interaction.followUp({
        content: locale.commands.xp.leaderboard.noData,
        ephemeral: true,
      });
      return;
    }

    // Update avatar URLs
    for (const entry of leaderboardData.entries) {
      const member = await interaction.guild!.members.fetch(entry.userId).catch(() => null);
      if (member) {
        entry.avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 64 });
        entry.username = member.displayName;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(locale.commands.xp.leaderboard.title.replace('{{guild}}', interaction.guild!.name))
      .setDescription(
        leaderboardData.entries
          .map((entry) => {
            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `**${entry.rank}.**`;
            return `${medal} <@${entry.userId}> - ${locale.commands.xp.leaderboard.entry
              .replace('{{level}}', entry.level.toString())
              .replace('{{xp}}', entry.xp.toLocaleString())}`;
          })
          .join('\n')
      )
      .setFooter({
        text: locale.commands.xp.leaderboard.footer
          .replace('{{page}}', newPage.toString())
          .replace('{{total}}', leaderboardData.totalPages.toString()),
      })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`xp_leaderboard_prev_${newPage}`)
        .setLabel(locale.commands.xp.leaderboard.previous)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(newPage === 1),
      new ButtonBuilder()
        .setCustomId(`xp_leaderboard_next_${newPage}`)
        .setLabel(locale.commands.xp.leaderboard.next)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(newPage >= leaderboardData.totalPages)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    logger.error('Failed to handle leaderboard navigation:', error);
    
    await interaction.followUp({
      content: locale.common.error,
      ephemeral: true,
    });
  }
}