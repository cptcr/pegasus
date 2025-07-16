import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, formatNumber } from '../../utils/helpers';
import { economyHandler } from '../../handlers/economy';
import { colors, emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your or another user\'s balance')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check balance for')
        .setRequired(false)
    )
    .setDMPermission(false);

export async function execute(interaction: any) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('user') || interaction.user;
    
    if (targetUser.bot) {
      return interaction.reply({
        content: `${emojis.error} Bots don't have economy accounts!`,
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      const economyUser = await economyHandler.getUser(targetUser.id, interaction.guild.id);
      
      const totalWealth = economyUser.coins + economyUser.bank;
      const bankPercentage = economyUser.bankLimit > 0 
        ? Math.round((economyUser.bank / economyUser.bankLimit) * 100)
        : 0;

      const embed = createEmbed({
        title: `${emojis.diamond} ${targetUser.username}'s Balance`,
        color: colors.success,
        thumbnail: targetUser.displayAvatarURL(),
        fields: [
          {
            name: '🪙 Wallet',
            value: `${formatNumber(economyUser.coins)} coins`,
            inline: true,
          },
          {
            name: '🏦 Bank',
            value: `${formatNumber(economyUser.bank)} / ${formatNumber(economyUser.bankLimit)} coins\n(${bankPercentage}% full)`,
            inline: true,
          },
          {
            name: '💎 Net Worth',
            value: `${formatNumber(totalWealth)} coins`,
            inline: true,
          },
          {
            name: '📊 Statistics',
            value: `💰 Total Earned: ${formatNumber(economyUser.totalEarned)}\n` +
                   `💸 Total Spent: ${formatNumber(economyUser.totalSpent)}\n` +
                   `🔥 Daily Streak: ${economyUser.dailyStreak}\n` +
                   `⚡ Work Streak: ${economyUser.workStreak}`,
            inline: false,
          },
        ],
        timestamp: true,
      });

      if (economyUser.multiplier > 1) {
        embed.addFields({
          name: '🚀 Multiplier',
          value: `${economyUser.multiplier}x`,
          inline: true,
        });
      }

      if (economyUser.prestige > 0) {
        embed.addFields({
          name: '⭐ Prestige',
          value: `Level ${economyUser.prestige}`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error fetching balance:', error);
      await interaction.editReply({
        content: `${emojis.error} Failed to fetch balance information.`,
      });
    }
  }