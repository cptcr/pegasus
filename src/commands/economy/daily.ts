import { SlashCommandBuilder } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, formatTime, formatNumber } from '../../utils/helpers';
import { economyHandler } from '../../handlers/economy';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward')
    .setDMPermission(false);

export async function execute(interaction: any) {
    if (!interaction.guild) return;

    await interaction.deferReply();

    try {
      const result = await economyHandler.dailyReward(interaction.user.id, interaction.guild.id);
      
      if (result.cooldown) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Daily Cooldown',
            `You can claim your daily reward again in ${formatTime(result.cooldown)}.`
          )],
        });
      }

      const embed = createSuccessEmbed(
        'Daily Reward Claimed!',
        `${emojis.tada} You received **${formatNumber(result.amount)}** coins!`
      );

      embed.addFields(
        {
          name: '🔥 Daily Streak',
          value: `${result.streak} day${result.streak !== 1 ? 's' : ''}`,
          inline: true,
        },
        {
          name: '💡 Tip',
          value: result.streak < 7 
            ? `Claim daily for ${7 - result.streak} more day${7 - result.streak !== 1 ? 's' : ''} to maximize your streak!`
            : 'Keep up the streak to maintain maximum rewards!',
          inline: false,
        }
      );

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error claiming daily reward:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to claim daily reward.')],
      });
    }
  }