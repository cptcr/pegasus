import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('flip')
  .setDescription('Flip a coin or multiple coins')
  .addIntegerOption(option =>
    option.setName('count')
      .setDescription('Number of coins to flip (1-10)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10)
  )
  .addStringOption(option =>
    option.setName('call')
      .setDescription('Call heads or tails (only works with single coin flip)')
      .setRequired(false)
      .addChoices(
        { name: 'Heads', value: 'heads' },
        { name: 'Tails', value: 'tails' }
      )
  );

export async function execute(interaction: any) {
  const count = interaction.options.getInteger('count') || 1;
  const call = interaction.options.getString('call');

  try {
    if (count === 1) {
      await handleSingleFlip(interaction, call);
    } else {
      await handleMultipleFlips(interaction, count);
    }
  } catch (error) {
    console.error('Error in flip command:', error);
    await interaction.reply({
      content: 'An error occurred while flipping the coin(s). Please try again.',
      ephemeral: true,
    });
  }
}

async function handleSingleFlip(interaction: any, call: string | null) {
  const isHeads = Math.random() < 0.5;
  const result = isHeads ? 'heads' : 'tails';
  
  const embed = new EmbedBuilder()
    .setTitle(`${emojis.coin} Coin Flip`)
    .setColor(colors.primary)
    .setTimestamp();

  // Create a visual representation
  const coinEmoji = isHeads ? '🪙' : '🪙';
  const resultText = isHeads ? '**HEADS**' : '**TAILS**';
  
  embed.setDescription(`${coinEmoji} The coin landed on ${resultText}!`);

  // If user made a call, check if they were right
  if (call) {
    const wasCorrect = call === result;
    const callText = call.charAt(0).toUpperCase() + call.slice(1);
    
    embed.addFields({
      name: '🎯 Your Call',
      value: callText,
      inline: true
    });

    embed.addFields({
      name: '🎲 Result',
      value: wasCorrect ? '✅ Correct!' : '❌ Wrong!',
      inline: true
    });

    if (wasCorrect) {
      embed.addFields({
        name: '🎉 Congratulations!',
        value: 'You called it right!',
        inline: false
      });
      embed.setColor(colors.success);
    } else {
      embed.addFields({
        name: '😔 Better luck next time!',
        value: 'You\'ll get it next time!',
        inline: false
      });
      embed.setColor(colors.error);
    }
  }

  // Add some fun flavor text
  const flavorTexts = [
    'The coin spins through the air...',
    'It\'s spinning... spinning...',
    'The coin flips end over end...',
    'Round and round it goes...',
    'The coin tumbles through the air...'
  ];
  
  const randomFlavor = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];
  
  embed.setFooter({
    text: `${randomFlavor} • Flipped by ${interaction.user.username}`,
    iconURL: interaction.user.displayAvatarURL()
  });

  await interaction.reply({ embeds: [embed] });
}

async function handleMultipleFlips(interaction: any, count: number) {
  const results: boolean[] = [];
  
  // Flip multiple coins
  for (let i = 0; i < count; i++) {
    results.push(Math.random() < 0.5);
  }

  const headsCount = results.filter(r => r).length;
  const tailsCount = results.filter(r => !r).length;

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.coin} Multiple Coin Flip`)
    .setColor(colors.primary)
    .setTimestamp();

  // Create visual representation of results
  const coinResults = results.map(isHeads => isHeads ? 'H' : 'T').join(' ');
  const coinEmojis = results.map(isHeads => isHeads ? '🟡' : '⚫').join(' ');

  embed.addFields({
    name: `🎲 Results (${count} coins)`,
    value: `\`${coinResults}\`\n${coinEmojis}`,
    inline: false
  });

  embed.addFields(
    { name: '🟡 Heads', value: headsCount.toString(), inline: true },
    { name: '⚫ Tails', value: tailsCount.toString(), inline: true },
    { name: '📊 Ratio', value: `${((headsCount / count) * 100).toFixed(1)}% heads`, inline: true }
  );

  // Add statistics for larger samples
  if (count >= 5) {
    const streak = calculateLongestStreak(results);
    embed.addFields({
      name: '📈 Statistics',
      value: [
        `**Longest Streak:** ${streak.length} ${streak.type}`,
        `**Most Common:** ${headsCount > tailsCount ? 'Heads' : tailsCount > headsCount ? 'Tails' : 'Tied'}`,
        `**Difference:** ${Math.abs(headsCount - tailsCount)}`
      ].join('\n'),
      inline: false
    });
  }

  // Add special messages for interesting results
  if (headsCount === count) {
    embed.addFields({
      name: '🎉 All Heads!',
      value: `What are the odds? All ${count} coins landed on heads!`,
      inline: false
    });
    embed.setColor(colors.success);
  } else if (tailsCount === count) {
    embed.addFields({
      name: '🎯 All Tails!',
      value: `Incredible! All ${count} coins landed on tails!`,
      inline: false
    });
    embed.setColor(colors.success);
  } else if (headsCount === tailsCount) {
    embed.addFields({
      name: '⚖️ Perfect Balance!',
      value: 'A perfect 50/50 split!',
      inline: false
    });
    embed.setColor(colors.warning);
  }

  embed.setFooter({
    text: `Flipped by ${interaction.user.username} • Probability of this exact sequence: ${(1 / Math.pow(2, count) * 100).toFixed(4)}%`,
    iconURL: interaction.user.displayAvatarURL()
  });

  await interaction.reply({ embeds: [embed] });
}

function calculateLongestStreak(results: boolean[]): { length: number, type: string } {
  let longestStreak = 0;
  let longestType = '';
  let currentStreak = 1;
  let currentType = results[0] ? 'heads' : 'tails';

  for (let i = 1; i < results.length; i++) {
    const currentResult = results[i] ? 'heads' : 'tails';
    
    if (currentResult === currentType) {
      currentStreak++;
    } else {
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
        longestType = currentType;
      }
      currentStreak = 1;
      currentType = currentResult;
    }
  }

  // Check final streak
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
    longestType = currentType;
  }

  return { length: longestStreak, type: longestType };
}