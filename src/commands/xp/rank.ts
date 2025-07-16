import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createEmbed, getXpForLevel, getXpToNextLevel, createProgressBar } from '../../utils/helpers';
import { xpHandler } from '../../handlers/xp';
import { colors, emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your or another user\'s rank and XP')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check rank for')
        .setRequired(false)
    )
    .setDMPermission(false);

export async function execute(interaction: any) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('user') || interaction.user;
    
    if (targetUser.bot) {
      return interaction.reply({
        content: `${emojis.error} Bots don't have XP!`,
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const profile = await xpHandler.getUserProfile(targetUser.id, interaction.guild.id);
      const rank = await xpHandler.getUserRank(targetUser.id, interaction.guild.id);
      
      const currentLevelXp = getXpForLevel(profile.level);
      const nextLevelXp = getXpForLevel(profile.level + 1);
      const xpToNext = getXpToNextLevel(profile.total_xp, profile.level);
      const progressXp = profile.total_xp - currentLevelXp;
      const requiredXp = nextLevelXp - currentLevelXp;
      
      const progressBar = createProgressBar(progressXp, requiredXp);

      const embed = createEmbed({
        title: `${emojis.xp} ${targetUser.username}'s Rank`,
        color: colors.primary,
        thumbnail: targetUser.displayAvatarURL(),
        fields: [
          {
            name: 'Rank',
            value: `#${rank}`,
            inline: true,
          },
          {
            name: 'Level',
            value: `${profile.level}`,
            inline: true,
          },
          {
            name: 'Total XP',
            value: `${profile.total_xp.toLocaleString()}`,
            inline: true,
          },
          {
            name: 'Progress to Next Level',
            value: `${progressBar}\n${progressXp.toLocaleString()}/${requiredXp.toLocaleString()} XP`,
            inline: false,
          },
          {
            name: 'Statistics',
            value: `${emojis.voice} Voice Time: ${Math.floor(profile.voice_time / 3600)}h ${Math.floor((profile.voice_time % 3600) / 60)}m\n` +
                   `💬 Messages: ${profile.message_count.toLocaleString()}\n` +
                   `⭐ Reputation: ${profile.reputation}\n` +
                   `🪙 Coins: ${profile.coins.toLocaleString()}`,
            inline: false,
          },
        ],
        footer: `XP needed for next level: ${xpToNext.toLocaleString()}`,
        timestamp: true,
      });

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error fetching rank:', error);
      await interaction.editReply({
        content: `${emojis.error} Failed to fetch rank information. Please try again.`,
      });
    }
  }