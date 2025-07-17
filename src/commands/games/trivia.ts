import { SlashCommandBuilder } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { gameHandler } from '../../handlers/games';

export const data = new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Start a trivia game')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start a new trivia game')
        .addIntegerOption(option =>
          option.setName('rounds')
            .setDescription('Number of questions (1-50)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Question category')
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option.setName('difficulty')
            .setDescription('Question difficulty')
            .setRequired(false)
            .addChoices(
              { name: 'Easy', value: 'easy' },
              { name: 'Medium', value: 'medium' },
              { name: 'Hard', value: 'hard' },
              { name: 'All', value: 'all' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Stop the current trivia game')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Show trivia statistics and available categories')
    )
    .setDMPermission(false);

export async function execute(interaction: any) {
    if (!interaction.guild || !interaction.channel) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'start':
        await handleStart(interaction);
        break;
      case 'stop':
        await handleStop(interaction);
        break;
      case 'stats':
        await handleStats(interaction);
        break;
    }
  }

async function handleStart(interaction: any) {
  const rounds = interaction.options.getInteger('rounds') || 10;
  const category = interaction.options.getString('category');
  const difficulty = interaction.options.getString('difficulty');

  if (gameHandler.isGameActive(interaction.channel.id)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'A game is already active in this channel.')],
      ephemeral: true,
    });
  }

  // Check if enough questions are available
  if (!gameHandler.canStartGame(rounds, category, difficulty)) {
    const available = gameHandler.getQuestionCount(category, difficulty);
    return interaction.reply({
      embeds: [createErrorEmbed('Error', `Not enough questions available. Requested: ${rounds}, Available: ${available}`)],
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
      rounds,
      category,
      difficulty
    );
  } catch (error) {
    console.error('Error starting trivia game:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Failed to start trivia game.')],
    });
  }
}

async function handleStop(interaction: any) {
  if (!gameHandler.isGameActive(interaction.channel.id)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Error', 'No active game in this channel.')],
      ephemeral: true,
    });
  }

  const stopped = await gameHandler.stopGame(interaction.channel.id);
  
  if (stopped) {
    await interaction.reply({
      embeds: [createSuccessEmbed('Game Stopped', 'The trivia game has been stopped.')],
    });
  } else {
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to stop the game.')],
      ephemeral: true,
    });
  }
}

async function handleStats(interaction: any) {
  const stats = gameHandler.getTriviaStats();
  
  const embed = createSuccessEmbed('Trivia Statistics', 'Available questions and categories');
  
  embed.addFields([
    {
      name: '📊 Total Questions',
      value: stats.totalQuestions.toString(),
      inline: true
    },
    {
      name: '📚 Categories',
      value: stats.categories.length.toString(),
      inline: true
    },
    {
      name: '⚡ Difficulties',
      value: stats.difficulties.join(', '),
      inline: true
    }
  ]);

  // Add category breakdown
  const categoryBreakdown = Object.entries(stats.categoryStats)
    .map(([category, count]) => `**${category}:** ${count}`)
    .join('\\n');

  if (categoryBreakdown.length > 0) {
    embed.addFields([
      {
        name: '📋 Questions by Category',
        value: categoryBreakdown,
        inline: false
      }
    ]);
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Handle autocomplete for categories
export async function autocomplete(interaction: any) {
  const focusedValue = interaction.options.getFocused();
  const categories = ['all', ...gameHandler.getAvailableCategories()];
  
  const filtered = categories.filter(category => 
    category.toLowerCase().includes(focusedValue.toLowerCase())
  ).slice(0, 25); // Discord limit

  await interaction.respond(
    filtered.map(category => ({ name: category, value: category }))
  );
}