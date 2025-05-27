// src/commands/fun/dice.ts - Dice Roll Fun Command
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'dice',
  description: 'Roll dice with customizable sides and count',
  category: 'fun',
  usage: '/dice [count] [sides]',
  examples: [
    '/dice',
    '/dice count:2',
    '/dice sides:20',
    '/dice count:3 sides:10'
  ],
  aliases: ['roll', 'd6', 'd20'],
  cooldown: 2,
  guildOnly: false
};

const diceEmojis: Record<number, string> = {
  1: '⚀',
  2: '⚁',
  3: '⚂',
  4: '⚃',
  5: '⚄',
  6: '⚅'
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll dice with customizable sides and count')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of dice to roll (1-20)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('sides')
        .setDescription('Number of sides on each die (2-100)')
        .setMinValue(2)
        .setMaxValue(100)
        .setRequired(false)),
  category: 'fun',
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient) {
    const count = interaction.options.getInteger('count') || 1;
    const sides = interaction.options.getInteger('sides') || 6;

    const results: number[] = [];
    let total = 0;

    // Roll the dice
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      results.push(roll);
      total += roll;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎲 Dice Roll${count > 1 ? ` (${count}d${sides})` : ` (1d${sides})`}`)
      .setColor(Config.COLORS.INFO)
      .setFooter({ 
        text: `Rolled by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    if (count === 1) {
      // Single die roll
      const result = results[0];
      const emoji = sides === 6 && diceEmojis[result] ? diceEmojis[result] : '🎲';
      
      embed.setDescription(`${emoji} **${result}**`);
      
      // Add special messages for notable rolls
      if (result === 1) {
        embed.addFields({ name: '💀 Critical Fail!', value: 'Ouch, that hurt!', inline: false });
      } else if (result === sides) {
        embed.addFields({ name: '🌟 Critical Success!', value: 'Maximum roll achieved!', inline: false });
      }
    } else {
      // Multiple dice rolls
      const resultString = results.map((result, index) => {
        const emoji = sides === 6 && diceEmojis[result] ? diceEmojis[result] : '🎲';
        return `${emoji} **${result}**`;
      }).join(' ');

      embed.addFields(
        {
          name: '🎯 Individual Rolls',
          value: resultString.length > 1024 ? 
            `${resultString.substring(0, 1000)}...` : 
            resultString,
          inline: false
        },
        {
          name: '📊 Statistics',
          value: `**Total:** ${total}\n**Average:** ${(total / count).toFixed(1)}\n**Range:** ${Math.min(...results)} - ${Math.max(...results)}`,
          inline: true
        }
      );

      // Calculate percentages and add analysis
      const maxPossible = count * sides;
      const percentage = ((total / maxPossible) * 100).toFixed(1);
      
      embed.addFields({
        name: '📈 Analysis',
        value: `**Percentage of Max:** ${percentage}%\n**Theoretical Average:** ${((sides + 1) / 2 * count).toFixed(1)}`,
        inline: true
      });

      // Add special achievements
      const achievements: string[] = [];
      
      // All same number
      if (results.every(r => r === results[0])) {
        achievements.push(`🎯 All ${results[0]}s!`);
      }
      
      // All max rolls
      if (results.every(r => r === sides)) {
        achievements.push('🌟 All maximum rolls!');
      }
      
      // All min rolls
      if (results.every(r => r === 1)) {
        achievements.push('💀 All minimum rolls!');
      }
      
      // Sequential rolls
      const sorted = [...results].sort((a, b) => a - b);
      let isSequential = true;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i-1] + 1) {
          isSequential = false;
          break;
        }
      }
      if (isSequential && count > 2) {
        achievements.push('🔢 Sequential roll!');
      }

      if (achievements.length > 0) {
        embed.addFields({
          name: '🏆 Achievements',
          value: achievements.join('\n'),
          inline: false
        });
      }
    }

    await interaction.reply({ embeds: [embed] });

    // Emit to dashboard for fun stats
    if (interaction.guild) {
      client.wsManager.emitRealtimeEvent(interaction.guild.id, 'fun:dice', {
        userId: interaction.user.id,
        count: count,
        sides: sides,
        results: results,
        total: total
      });
    }

    client.logger.debug(`${interaction.user.tag} rolled ${count}d${sides}: [${results.join(', ')}] = ${total}`);
  }
};

export default command;