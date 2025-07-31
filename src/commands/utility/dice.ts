import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/helpers';
import { emojis, colors } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('Roll dice with various options')
  .addSubcommand(subcommand =>
    subcommand
      .setName('roll')
      .setDescription('Roll dice (supports XdY format, e.g., 2d6 for two 6-sided dice)')
      .addStringOption(option =>
        option.setName('dice')
          .setDescription('Dice to roll (e.g., 1d6, 2d20, 3d8+5)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('simple')
      .setDescription('Roll simple dice')
      .addIntegerOption(option =>
        option.setName('sides')
          .setDescription('Number of sides on the die')
          .setRequired(false)
          .setMinValue(2)
          .setMaxValue(1000)
      )
      .addIntegerOption(option =>
        option.setName('count')
          .setDescription('Number of dice to roll')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stats')
      .setDescription('Roll 4d6 drop lowest for D&D stats (6 times)')
  );

export async function execute(interaction: any) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'roll':
        await handleAdvancedRoll(interaction);
        break;
      case 'simple':
        await handleSimpleRoll(interaction);
        break;
      case 'stats':
        await handleStatsRoll(interaction);
        break;
    }
  } catch (error) {
    console.error('Error in dice command:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Failed to roll dice. Please try again.')],
      ephemeral: true,
    });
  }
}

async function handleAdvancedRoll(interaction: any) {
  const diceInput = interaction.options.getString('dice') || '1d6';

  // Parse dice notation (XdY+Z or XdY-Z)
  const diceRegex = /^(\d+)?d(\d+)([+\-]\d+)?$/i;
  const match = diceInput.match(diceRegex);

  if (!match) {
    return interaction.reply({
      embeds: [createErrorEmbed('Invalid Format', 'Please use dice notation like: 1d6, 2d20, 3d8+5, 4d6-2')],
      ephemeral: true,
    });
  }

  const numDice = parseInt(match[1] || '1');
  const numSides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  // Validation
  if (numDice > 20) {
    return interaction.reply({
      embeds: [createErrorEmbed('Too Many Dice', 'Maximum 20 dice can be rolled at once.')],
      ephemeral: true,
    });
  }

  if (numSides > 1000) {
    return interaction.reply({
      embeds: [createErrorEmbed('Too Many Sides', 'Maximum 1000 sides per die.')],
      ephemeral: true,
    });
  }

  if (numSides < 2) {
    return interaction.reply({
      embeds: [createErrorEmbed('Invalid Dice', 'Dice must have at least 2 sides.')],
      ephemeral: true,
    });
  }

  // Roll the dice
  const rolls: number[] = [];
  let total = 0;

  for (let i = 0; i < numDice; i++) {
    const roll = Math.floor(Math.random() * numSides) + 1;
    rolls.push(roll);
    total += roll;
  }

  const finalTotal = total + modifier;

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.dice} Dice Roll`)
    .setColor(colors.primary)
    .setTimestamp();

  embed.addFields(
    { name: '🎯 Roll', value: diceInput, inline: true },
    { name: '🎲 Individual Rolls', value: rolls.join(', '), inline: true },
    { name: '📊 Total', value: `${total}${modifier !== 0 ? ` ${modifier >= 0 ? '+' : ''}${modifier} = ${finalTotal}` : ''}`, inline: true }
  );

  // Add some statistics for multiple dice
  if (numDice > 1) {
    const min = Math.min(...rolls);
    const max = Math.max(...rolls);
    const average = (total / numDice).toFixed(2);

    embed.addFields({
      name: '📈 Statistics',
      value: [
        `**Minimum Roll:** ${min}`,
        `**Maximum Roll:** ${max}`,
        `**Average:** ${average}`,
        `**Sum:** ${total}`
      ].join('\n'),
      inline: false
    });
  }

  // Add special messages for certain rolls
  const specialMessages = [];
  
  if (rolls.every(roll => roll === numSides)) {
    specialMessages.push('🎉 **NATURAL MAX!** All dice rolled maximum!');
  } else if (rolls.every(roll => roll === 1)) {
    specialMessages.push('💀 **CRITICAL FAIL!** All dice rolled 1!');
  } else if (numSides === 20 && rolls.includes(20)) {
    specialMessages.push('⭐ **NATURAL 20!** Critical success!');
  } else if (numSides === 20 && rolls.includes(1)) {
    specialMessages.push('💔 **NATURAL 1!** Critical failure!');
  }

  if (specialMessages.length > 0) {
    embed.addFields({
      name: '🎪 Special Roll',
      value: specialMessages.join('\n'),
      inline: false
    });
  }

  embed.setFooter({
    text: `Rolled by ${interaction.user.username}`,
    iconURL: interaction.user.displayAvatarURL()
  });

  await interaction.reply({ embeds: [embed] });
}

async function handleSimpleRoll(interaction: any) {
  const sides = interaction.options.getInteger('sides') || 6;
  const count = interaction.options.getInteger('count') || 1;

  const rolls: number[] = [];
  let total = 0;

  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    total += roll;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.dice} Simple Dice Roll`)
    .setColor(colors.primary)
    .setTimestamp();

  embed.addFields(
    { name: '🎯 Dice', value: `${count}d${sides}`, inline: true },
    { name: '🎲 Result', value: count === 1 ? rolls[0].toString() : rolls.join(', '), inline: true },
    { name: '📊 Total', value: total.toString(), inline: true }
  );

  if (count > 1) {
    const min = Math.min(...rolls);
    const max = Math.max(...rolls);
    const average = (total / count).toFixed(2);

    embed.addFields({
      name: '📈 Statistics',
      value: [
        `**Minimum:** ${min}`,
        `**Maximum:** ${max}`,
        `**Average:** ${average}`
      ].join('\n'),
      inline: false
    });
  }

  // Visual representation for small numbers
  if (count === 1 && sides <= 6) {
    const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const diceEmoji = diceEmojis[rolls[0]];
    if (diceEmoji) {
      embed.setDescription(`${diceEmoji} **${rolls[0]}**`);
    }
  }

  embed.setFooter({
    text: `Rolled by ${interaction.user.username}`,
    iconURL: interaction.user.displayAvatarURL()
  });

  await interaction.reply({ embeds: [embed] });
}

async function handleStatsRoll(interaction: any) {
  const stats: { rolls: number[], total: number }[] = [];
  
  // Roll 6 stats (4d6 drop lowest each)
  for (let i = 0; i < 6; i++) {
    const rolls = [];
    for (let j = 0; j < 4; j++) {
      rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    
    rolls.sort((a, b) => b - a); // Sort descending
    const total = rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0); // Sum top 3
    
    stats.push({ rolls, total });
  }

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.dice} D&D Ability Scores`)
    .setColor(colors.primary)
    .setDescription('Rolled 4d6, dropped lowest die for each stat')
    .setTimestamp();

  const statNames = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
  const statEmojis = ['💪', '🏃', '❤️', '🧠', '👁️', '✨'];

  let statsText = '';
  let totalPoints = 0;

  stats.forEach((stat, index) => {
    const droppedRoll = stat.rolls[3]; // The lowest roll that was dropped
    const keptRolls = stat.rolls.slice(0, 3);
    
    statsText += `${statEmojis[index]} **${statNames[index]}:** ${stat.total}\n`;
    statsText += `   *(Rolled: ${stat.rolls.join(', ')}, dropped ${droppedRoll})*\n\n`;
    
    totalPoints += stat.total;
  });

  embed.addFields({
    name: '📊 Ability Scores',
    value: statsText,
    inline: false
  });

  // Calculate some statistics
  const totals = stats.map(s => s.total);
  const minStat = Math.min(...totals);
  const maxStat = Math.max(...totals);
  const averageStat = (totalPoints / 6).toFixed(1);

  embed.addFields({
    name: '📈 Statistics',
    value: [
      `**Total Points:** ${totalPoints}`,
      `**Average Stat:** ${averageStat}`,
      `**Highest Stat:** ${maxStat}`,
      `**Lowest Stat:** ${minStat}`,
      `**Point Buy Equivalent:** ~${Math.max(0, totalPoints - 72)} extra points`
    ].join('\n'),
    inline: false
  });

  // Add special comments based on the roll quality
  if (totalPoints >= 85) {
    embed.addFields({
      name: '🎉 Exceptional Character!',
      value: 'These are outstanding ability scores! Your character will be very capable.',
      inline: false
    });
  } else if (totalPoints <= 65) {
    embed.addFields({
      name: '😅 Challenging Character',
      value: 'These scores will make for an interesting, flawed character with lots of roleplay potential!',
      inline: false
    });
  }

  embed.setFooter({
    text: `Rolled for ${interaction.user.username} • Total: ${totalPoints} points`,
    iconURL: interaction.user.displayAvatarURL()
  });

  await interaction.reply({ embeds: [embed] });
}