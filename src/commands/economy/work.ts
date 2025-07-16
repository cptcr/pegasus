import { SlashCommandBuilder } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, formatTime, formatNumber } from '../../utils/helpers';
import { economyHandler } from '../../handlers/economy';
import { emojis } from '../../utils/config';

export const data = new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn coins')
    .setDMPermission(false);

export async function execute(interaction: any) {
    if (!interaction.guild) return;

    await interaction.deferReply();

    try {
      const result = await economyHandler.work(interaction.user.id, interaction.guild.id);
      
      if (result.cooldown) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Work Cooldown',
            `You can work again in ${formatTime(result.cooldown)}.`
          )],
        });
      }

      const embed = createSuccessEmbed(
        'Work Complete!',
        `${result.job.emoji} **${result.job.name}** - ${result.job.description}\n\n` +
        `${emojis.diamond} You earned **${formatNumber(result.amount)}** coins!`
      );

      embed.addFields(
        {
          name: '⚡ Work Streak',
          value: `${result.streak} shift${result.streak !== 1 ? 's' : ''}`,
          inline: true,
        },
        {
          name: '⏰ Next Work',
          value: 'Available in 4 hours',
          inline: true,
        }
      );

      if (result.streak > 1) {
        embed.addFields({
          name: '🎯 Streak Bonus',
          value: `+${Math.min(result.streak * 5, 100)} coins`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error working:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to work.')],
      });
    }
  }