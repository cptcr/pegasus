import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandCategory } from '../../types/command';
import { economyService } from '../../services/economyService';
import { economyRepository } from '../../repositories/economyRepository';
import { embedBuilder } from '../../handlers/embedBuilder';
import { logger } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily reward')
  .setDescriptionLocalizations({
    'es-ES': 'Reclama tu recompensa diaria',
    fr: 'Réclamez votre récompense quotidienne',
    de: 'Fordere deine tägliche Belohnung an',
  });

export const category = CommandCategory.Economy;
export const cooldown = 3;

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    const result = await economyService.claimDaily(userId, guildId);

    if (!result.success) {
      await interaction.editReply({
        embeds: [embedBuilder.createErrorEmbed(result.error!)],
      });
      return;
    }

    const settings = await economyRepository.ensureSettings(guildId);
    const metadata = result.transaction?.metadata as any;
    const streakDays = metadata?.streakDays || 1;

    const embed = new EmbedBuilder()
      .setTitle('Daily Reward Claimed!')
      .setDescription(`You received your daily reward!`)
      .setColor(0x2ecc71)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: 'Reward',
          value: `${settings.currencySymbol} ${result.transaction!.amount.toLocaleString()}`,
          inline: true,
        },
        {
          name: 'Streak',
          value: `${streakDays} day${streakDays > 1 ? 's' : ''}`,
          inline: true,
        },
        {
          name: 'New Balance',
          value: `${settings.currencySymbol} ${result.balance!.balance.toLocaleString()}`,
          inline: true,
        }
      )
      .setFooter({ text: 'Come back tomorrow for more rewards!' })
      .setTimestamp();

    if (streakDays > 1) {
      embed.addFields({
        name: 'Streak Bonus',
        value: `You earned ${settings.currencySymbol}${settings.dailyStreakBonus * (streakDays - 1)} extra for your ${streakDays} day streak!`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error in daily command:', error);
    await interaction.editReply({
      embeds: [
        embedBuilder.createErrorEmbed('Failed to claim daily reward. Please try again later.'),
      ],
    });
  }
}
