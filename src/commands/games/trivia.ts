import { SlashCommandBuilder } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { gameHandler } from '../../handlers/games';

export const data = new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Start a trivia game')
    .addIntegerOption(option =>
      option.setName('rounds')
        .setDescription('Number of questions (1-20)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    )
    .setDMPermission(false);

export async function execute(interaction: any) {
    if (!interaction.guild || !interaction.channel) return;

    const rounds = interaction.options.getInteger('rounds') || 10;

    if (gameHandler.isGameActive(interaction.channel.id)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Error', 'A game is already active in this channel.')],
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [createSuccessEmbed('Starting Game', 'Setting up trivia game...')],
      ephemeral: true,
    });

    try {
      await gameHandler.startTriviaGame(
        interaction.guild.id,
        interaction.channel.id,
        interaction.user.id,
        rounds
      );
    } catch (error) {
      console.error('Error starting trivia game:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to start trivia game.')],
      });
    }
  }