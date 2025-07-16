import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed, formatNumber } from '../../utils/helpers';
import { xpHandler } from '../../handlers/xp';
import { colors, emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the XP leaderboard')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of users to show (max 25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    )
    .setDMPermission(false);

export async function execute(interaction: any) {
    if (!interaction.guild) return;

    const limit = interaction.options.getInteger('limit') || 10;

    await interaction.deferReply();

    try {
      const leaderboard = await xpHandler.getLeaderboard(interaction.guild.id, limit);
      
      if (leaderboard.length === 0) {
        return interaction.editReply({
          content: `${emojis.error} No users found in the leaderboard.`,
        });
      }

      const embed = createEmbed({
        title: `${emojis.crown} XP Leaderboard`,
        description: `Top ${leaderboard.length} users in **${interaction.guild.name}**`,
        color: colors.primary,
        thumbnail: interaction.guild.iconURL(),
        timestamp: true,
      });

      let description = '';
      const medals = ['🥇', '🥈', '🥉'];

      for (let i = 0; i < leaderboard.length; i++) {
        const user = leaderboard[i];
        const member = await interaction.guild.members.fetch(user.user_id).catch(() => null);
        
        if (!member) continue;

        const medal = medals[i] || `**${i + 1}.**`;
        const progressBar = '▰'.repeat(Math.min(10, Math.floor(user.level / 2))) + 
                           '▱'.repeat(10 - Math.min(10, Math.floor(user.level / 2)));

        description += `${medal} ${member.displayName}\n`;
        description += `   Level ${user.level} • ${formatNumber(user.total_xp)} XP\n`;
        description += `   ${progressBar}\n\n`;
      }

      embed.setDescription(description);

      const userRank = await xpHandler.getUserRank(interaction.user.id, interaction.guild.id);
      const userProfile = await xpHandler.getUserProfile(interaction.user.id, interaction.guild.id);

      embed.addFields({
        name: 'Your Rank',
        value: `#${userRank} • Level ${userProfile.level} • ${formatNumber(userProfile.total_xp)} XP`,
        inline: false,
      });

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      await interaction.editReply({
        content: `${emojis.error} Failed to fetch leaderboard. Please try again.`,
      });
    }
  }