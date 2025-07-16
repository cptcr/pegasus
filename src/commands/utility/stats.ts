import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { createErrorEmbed } from '../../utils/helpers';
import { statsHandler } from '../../handlers/stats';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View server statistics')
  .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of statistics to view')
        .setRequired(false)
        .addChoices(
          { name: 'Overview', value: 'overview' },
          { name: 'Activity', value: 'activity' },
          { name: 'Moderation', value: 'moderation' },
          { name: 'Users', value: 'users' }
        )
    )
    .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const type = interaction.options.getString('type') as 'overview' | 'activity' | 'moderation' | 'users' || 'overview';

    await interaction.deferReply();

    try {
      const embed = await statsHandler.generateStatsEmbed(interaction.guild, type);
      
      if (!embed) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error', 'Invalid statistics type.')],
        });
      }

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error generating stats:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to generate statistics.')],
      });
    }
}