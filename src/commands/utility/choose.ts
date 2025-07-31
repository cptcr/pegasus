import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('choose')
  .setDescription('Let the bot choose between multiple options')
  .addStringOption(option =>
    option.setName('options')
      .setDescription('Options separated by commas (e.g., pizza, burger, sushi)')
      .setRequired(true)
      .setMaxLength(1000)
  )
  .addIntegerOption(option =>
    option.setName('count')
      .setDescription('Number of options to choose (default: 1)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10)
  )
  .addBooleanOption(option =>
    option.setName('weighted')
      .setDescription('Use weighted random selection (gives different probabilities)')
      .setRequired(false)
  );

export async function execute(interaction: any) {
  const optionsInput = interaction.options.getString('options', true);
  const count = interaction.options.getInteger('count') || 1;
  const weighted = interaction.options.getBoolean('weighted') || false;

  try {
    // Parse options
    const options = optionsInput
      .split(',')
      .map(option => option.trim())
      .filter(option => option.length > 0);

    if (options.length < 2) {
      return interaction.reply({
        content: '❌ Please provide at least 2 options separated by commas.',
        ephemeral: true,
      });
    }

    if (options.length > 50) {
      return interaction.reply({
        content: '❌ Maximum 50 options allowed.',
        ephemeral: true,
      });
    }

    if (count > options.length) {
      return interaction.reply({
        content: `❌ Cannot choose ${count} options from only ${options.length} available options.`,
        ephemeral: true,
      });
    }

    let chosen: string[];

    if (weighted) {
      chosen = weightedRandomSelection(options, count);
    } else {
      chosen = randomSelection(options, count);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎯 Random Choice${count > 1 ? 's' : ''}`)
      .setColor(colors.primary)
      .setTimestamp();

    // Show all available options
    const optionsList = options.map((option, index) => `${index + 1}. ${option}`).join('\n');
    
    if (optionsList.length <= 1024) {
      embed.addFields({
        name: `📝 Available Options (${options.length})`,
        value: optionsList,
        inline: false
      });
    } else {
      embed.addFields({
        name: `📝 Available Options (${options.length})`,
        value: `${options.slice(0, 20).map((option, index) => `${index + 1}. ${option}`).join('\n')}\n*...and ${options.length - 20} more*`,
        inline: false
      });
    }

    // Show chosen option(s)
    if (count === 1) {
      embed.addFields({
        name: '🎉 I choose...',
        value: `**${chosen[0]}**`,
        inline: false
      });
    } else {
      const chosenList = chosen.map((choice, index) => `${index + 1}. **${choice}**`).join('\n');
      embed.addFields({
        name: `🎉 I choose these ${count} options:`,
        value: chosenList,
        inline: false
      });
    }

    // Add selection method info
    const methodInfo = weighted 
      ? '⚖️ Used weighted selection (options appeared earlier had slightly higher chances)'
      : '🎲 Used random selection (all options had equal chances)';

    embed.addFields({
      name: '🔍 Selection Method',
      value: methodInfo,
      inline: false
    });

    // Add some fun statistics
    if (options.length > 5) {
      const probability = count === 1 
        ? `${(100 / options.length).toFixed(2)}%`
        : `${(factorial(options.length) / (factorial(count) * factorial(options.length - count)) / Math.pow(options.length, count) * 100).toFixed(4)}%`;

      embed.addFields({
        name: '📊 Probability',
        value: `Each option had a ${count === 1 ? probability : '~equal'} chance of being selected`,
        inline: false
      });
    }

    // Add fun reactions for certain scenarios
    if (chosen.length === 1) {
      const reactions = [
        'The choice has been made! 🎯',
        'Destiny has spoken! ✨',
        'The universe has decided! 🌟',
        'Your fate is sealed! 🎭',
        'The answer is clear! 💫'
      ];
      
      const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
      embed.setDescription(randomReaction);
    }

    embed.setFooter({
      text: `Chosen for ${interaction.user.username} • Total options: ${options.length}`,
      iconURL: interaction.user.displayAvatarURL()
    });

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in choose command:', error);
    await interaction.reply({
      content: 'An error occurred while making the choice. Please try again.',
      ephemeral: true,
    });
  }
}

function randomSelection(options: string[], count: number): string[] {
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function weightedRandomSelection(options: string[], count: number): string[] {
  // Create weights - earlier options get slightly higher weights
  const weights = options.map((_, index) => {
    return Math.max(0.1, 1 - (index * 0.05)); // Decreasing weights
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const normalizedWeights = weights.map(weight => weight / totalWeight);

  const chosen: string[] = [];
  const availableOptions = [...options];
  const availableWeights = [...normalizedWeights];

  for (let i = 0; i < count; i++) {
    if (availableOptions.length === 0) break;

    // Weighted random selection
    const random = Math.random();
    let cumulativeWeight = 0;
    let selectedIndex = 0;

    for (let j = 0; j < availableWeights.length; j++) {
      cumulativeWeight += availableWeights[j];
      if (random <= cumulativeWeight) {
        selectedIndex = j;
        break;
      }
    }

    // Add chosen option and remove it from available options
    chosen.push(availableOptions[selectedIndex]);
    availableOptions.splice(selectedIndex, 1);
    availableWeights.splice(selectedIndex, 1);

    // Renormalize weights
    const newTotalWeight = availableWeights.reduce((sum, weight) => sum + weight, 0);
    if (newTotalWeight > 0) {
      for (let k = 0; k < availableWeights.length; k++) {
        availableWeights[k] = availableWeights[k] / newTotalWeight;
      }
    }
  }

  return chosen;
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}